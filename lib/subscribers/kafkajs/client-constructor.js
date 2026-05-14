/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base.js')
const MBD = require('#agentlib/message-broker-description.js')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')
const tools = require('#agentlib/subscribers/message-consumer-tools.js')
const { kafkaCtx } = require('#agentlib/symbols.js')

const recordDataMetrics = require('./utils/record-data-metrics.js')
const recordLinkingMetrics = require('./utils/record-linking-metrics.js')
const recordMethodMetric = require('./utils/record-method-metric.js')

const CONSUMER_METHODS = [
  'commitOffsets',
  'connect',
  'disconnect',
  'pause',
  'resume',
  'seek',
  'stop',
  'subscribe',
]
const CONSUMER_SEGMENT_PREFIX = 'kafkajs.Kafka.consumer#'

/**
 * The `kafkajs` library exports a class named `Client` that exposes two
 * methods: `.consumer` and `.producer`. Internally, these methods invoke
 * factory functions which return traditionally composed plain JavaScript
 * objects. In order for us to instrument this library correctly, we have
 * to intercept these class methods and patch the factory built objects
 * they return. The result is that we cannot separate out the consumer
 * and producer instrumentations into their own subscribers, and thus cannot
 * directly base them on narrower base implementations.
 *
 * Further complicating this instrumentation is how we represent message
 * consumer/producer systems. In short, for consumers:
 *
 * 1. We parent subscribe actions under the current transaction.
 * 2. We parent the receipt of messages under a new transaction.
 *
 * @type {ConstructorSubscriber}
 */
module.exports = class ConstructorSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_constructor', packageName: 'kafkajs' })
    this.requireActiveTx = false
    this.prefix = 'MessageBroker'
    this.events = ['end']
  }

  get enabled() {
    if (this.agent.config.feature_flag.kafkajs_instrumentation === false) {
      this.logger.debug(
        '`config.feature_flag.kafkajs_instrumentation is false, skipping instrumentation of kafkajs`'
      )
      return false
    }

    return super.enabled
  }

  /**
   * Picks up the data returned from the `kafkajs.Client` constructor, i.e.
   * the "client" in `const client = new kafkfajs.Client(options)`.
   *
   * @param {SubscriberHandlerData} data Data from Orchestrion.
   * @param {SubscriberHandlerContext} ctx Context from Orchestrion.
   *
   * @returns {SubscriberHandlerContext}
   */
  end(data, ctx) {
    const self = this
    const { arguments: args, self: client } = data
    client[kafkaCtx] = { brokers: args[0].brokers ?? ['none'] }

    const origConsumer = client.consumer
    client.consumer = function nrConsumer(...args) {
      const consumer = origConsumer.apply(client, args)
      consumer[kafkaCtx] = client[kafkaCtx]

      consumer.on(consumer.events.REQUEST, function nrListener(data) {
        consumer[kafkaCtx].clientId = data?.payload?.clientId
      })
      for (const method of CONSUMER_METHODS) {
        self.#wrapConsumerMethod(consumer, method)
      }
      // We have to wrap the `.run` method separately because it is where the
      // majority of the logic occurs. It is also quite complicated. In short,
      // the `.run` method looks for handlers defined by `eachMessage` and
      // `eachBatch` on the parameters to the function. The `eachMessage`
      // implementation is actually based on the `eachBatch` code. That is,
      // even if a handler for `eachBatch` is not provided, one will be created
      // and used to process the `eachMessage` handler. So we have to wrap
      // from the innermost handler, `eachMessage`, and wind our way out to
      // the outermost handler: `eachBatch`. Which translates into us starting
      // our TraceSegment within the `eachBatch` wrapper in order to cover
      // both `eachBatch` and `eachMessage`.
      self.#wrapRunForEachMessage(consumer)
      self.#wrapRunForBatches(consumer)
      return consumer
    }

    const origProducer = client.producer
    client.producer = function nrProducer(...args) {
      const producer = origProducer.apply(client, args)
      producer[kafkaCtx] = client[kafkaCtx]

      // The `.producer()` method returns an object with `send` and `sendBatch`
      // methods. The `send` method is merely a wrapper around `sendBatch`, but
      // we cannot simply wrap `sendBatch` because the `send` method does not
      // use the object scoped instance (i.e. `this.sendBatch`); it utilizes
      // the closure scoped instance of `sendBatch`. So we must wrap each
      // method.
      producer.send = self.#wrapProducerMethod(producer, 'send')
      producer.sendBatch = self.#wrapProducerMethod(producer, 'sendBatch')

      return producer
    }

    return ctx
  }

  /**
   * Used to wrap the majority of consumer methods in order to record their
   * usage.
   *
   * @param {object} instance Consumer client instance.
   * @param {string} methodName Name of the method being patched.
   */
  #wrapConsumerMethod(instance, methodName) {
    const self = this
    const orig = instance[methodName]

    instance[methodName] = function nrWrappedConsumerMethod(...args) {
      let ctx = self.agent.tracer.getContext()
      if (ctx.transaction == null || ctx.transaction.isActive() === false) {
        self.logger.debug(
          'Not recording consumer function %s, not in a transaction',
          methodName
        )
        return orig.apply(instance, args)
      }

      ctx = self.createSegment({
        name: CONSUMER_SEGMENT_PREFIX + methodName,
        recorder: genericRecorder,
        ctx
      })
      return self.agent.tracer.runInContext({ handler: orig, context: ctx, full: true, thisArg: instance, args })
    }
  }

  /**
   * Used to wrap the individual producer methods `.send` and `.sendBatch`.
   *
   * @param {object} instance Producer client instance.
   * @param {string} methodName Name of the method being patched.
   *
   * @returns {Function} The wrapped method.
   */
  #wrapProducerMethod(instance, methodName) {
    const self = this
    const orig = instance[methodName]
    const batch = methodName === 'sendBatch'
    return function nrWrappedMethod(...args) {
      let ctx = self.agent.tracer.getContext()
      if (ctx.transaction == null || ctx.transaction.isActive() === false) {
        self.logger.debug(
          'Not recording consumer function %s, not in a transaction',
          methodName
        )
        return orig.apply(instance, args)
      }

      const [data] = args
      const topic = batch === false ? data.topic : data.topicMessages[0].topic
      const mbd = new MBD({
        libraryName: MBD.LIB_KAFKA,
        destinationName: topic,
        destinationType: MBD.DESTINATION_TYPE_TOPIC
      })

      ctx = self.createSegment({
        name: mbd.segmentName,
        recorder: genericRecorder,
        ctx
      })
      recordMethodMetric({ agent: self.agent, name: methodName })
      recordLinkingMetrics({
        agent: self.agent,
        brokers: instance[kafkaCtx].brokers,
        topic
      })

      if (batch === false) {
        for (const msg of data.messages) {
          const headers = msg.headers ?? {}
          self.insertDTHeaders({ ctx, headers, useMqNames: true })
          msg.headers = headers
        }
      } else {
        for (const topicMessage of data.topicMessages) {
          for (const msg of topicMessage.messages) {
            const headers = msg.headers ?? {}
            self.insertDTHeaders({ ctx, headers, useMqNames: true })
            msg.headers = headers
          }
        }
      }

      return self.agent.tracer.runInContext({ handler: orig, context: ctx, full: true, thisArg: instance, args })
    }
  }

  /**
   * First wrapper for `consumer.run`. This creates the inner wrappers that
   * will be contained within the segment created by the `eachBatch`
   * wrapper.
   *
   * @param {object} instance Consumer client instance.
   */
  #wrapRunForEachMessage(instance) {
    const self = this
    const orig = instance.run

    instance.run = function nrWrappedRunForEachMessage(...args) {
      if (typeof args?.[0]?.eachMessage !== 'function') {
        return orig.apply(instance, args)
      }

      // We could've inlined the wrapper here, but that makes things very
      // difficult to read.
      self.#wrapEachMessage(instance, args)

      return orig.apply(instance, args)
    }
  }

  /**
   * Used to wrap the message handler function provided to `consumer.run`
   * via the arguments parameter.
   *
   * @param {object} instance Consumer client instance.
   * @param {object} runArgs The parameters object passed to the `.run` method.
   */
  #wrapEachMessage(instance, runArgs) {
    const self = this
    const orig = runArgs[0].eachMessage

    runArgs[0].eachMessage = function nrWrappedEachMessage(...args) {
      const [data] = args
      const { topic } = data
      const mbd = new MBD({
        libraryName: MBD.LIB_KAFKA,
        destinationName: topic,
        destinationType: MBD.DESTINATION_TYPE_TOPIC,
        mode: MBD.BROKER_MODE_CONSUME,
        includeMessageBrokerPrefix: false
      })

      // We need to process the received message ourselves before bubbling
      // it up to the original `eachMessage` handler. The outer
      // `nrWrappedEachMessage` is used to create a new transaction for this
      // handler to be executed under. So we need yet another wrapper for
      // the actual logic.
      const handler = function nrHandler() {
        const ctx = tools.startConsumeSegment({
          agent: self.agent,
          transport: MBD.TRANSPORT_TYPE_KAFKA,
          headers: data?.message?.headers,
          txName: mbd.segmentName
        })
        recordMethodMetric({ agent: self.agent, name: 'eachMessage' })
        recordLinkingMetrics({
          agent: self.agent,
          brokers: instance[kafkaCtx].brokers,
          producer: false,
          topic
        })
        recordDataMetrics({
          tx: ctx.transaction,
          kafkaCtx: instance[kafkaCtx],
          data
        })

        const ret = self.agent.tracer.runInContext({ handler: orig, context: ctx, full: true, thisArg: instance, args })
        tools.handleResult(ret, ctx?.transaction)
      }

      // Consumer handlers run within their own transaction. Basically,
      // the actions required to subscribe are assumed to have taken place
      // in an existing transaction. But the receipt of messages occur
      // out-of-band, like an incoming HTTP request, and so behave like a
      // server.
      const ctx = tools.initiateTransaction(self.agent)
      return self.agent.tracer.runInContext({ handler, context: ctx, full: true, thisArg: instance, args })
    }
  }

  /**
   * Secondary wrapper for `consumer.run` that handles the case when the
   * `eachBatch` callback is provided.
   *
   * @param {object} instance Consumer client instance.
   */
  #wrapRunForBatches(instance) {
    const self = this
    // In this case, `orig` is actually our first wrapper of the method.
    const orig = instance.run

    instance.run = function nrWrappedRunForBatches(...args) {
      let ctx = self.agent.tracer.getContext()
      if (!ctx.transaction || ctx.transaction.isActive() === false) {
        return orig.apply(instance, args)
      }
      ctx = self.createSegment({
        name: `${CONSUMER_SEGMENT_PREFIX}run`,
        recorder: genericRecorder,
        ctx
      })

      if (!args?.[0]?.eachBatch) {
        // We don't have a callback to invoke for each response from the
        // Kafka server. Thus, we can simply run the function.
        return self.agent.tracer.runInContext({ handler: orig, context: ctx, full: true, thisArg: instance, args })
      }

      // We have a callback that we need to wrap so that we can record
      // the metrics our system requires for batched messages.
      const eachBatch = args[0].eachBatch
      args[0].eachBatch = function nrWrappedEachBatch() {
        recordMethodMetric({ agent: self.agent, name: 'eachBatch' })
        recordLinkingMetrics({
          brokers: instance[kafkaCtx].brokers,
          agent: self.agent,
          topic: arguments[0].batch.topic,
          producer: false
        })
        return eachBatch.apply(instance, arguments)
      }
      return self.agent.tracer.runInContext({ handler: orig, context: ctx, full: true, thisArg: instance, args })
    }
  }
}
