/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { kafkaCtx } = require('../../symbols')
const { MessageSpec, MessageSubscribeSpec, RecorderSpec } = require('../../shim/specs')
const { DESTINATIONS } = require('../../config/attribute-filter')
const recordMethodMetric = require('./record-method-metric')
const recordLinkingMetrics = require('./record-linking-metrics')
const CONSUMER_METHODS = [
  'connect',
  'disconnect',
  'subscribe',
  'stop',
  'commitOffsets',
  'seek',
  'pause',
  'resume'
]
const SEGMENT_PREFIX = 'kafkajs.Kafka.consumer#'

module.exports = wrapConsumer

function wrapConsumer(shim, orig) {
  return function wrappedConsumer() {
    const args = shim.argsToArray.apply(shim, arguments)
    const consumer = orig.apply(this, args)
    consumer[kafkaCtx] = this[kafkaCtx]

    consumer.on(consumer.events.REQUEST, function listener(data) {
      consumer[kafkaCtx].clientId = data?.payload?.clientId
    })
    shim.record(consumer, CONSUMER_METHODS, function wrapper(shim, fn, name) {
      return new RecorderSpec({
        name: `${SEGMENT_PREFIX}${name}`,
        promise: true
      })
    })
    shim.recordSubscribedConsume(
      consumer,
      'run',
      new MessageSubscribeSpec({
        name: `${SEGMENT_PREFIX}#run`,
        destinationType: shim.TOPIC,
        promise: true,
        consumer: shim.FIRST,
        functions: ['eachMessage'],
        messageHandler: handler({ consumer })
      })
    )

    shim.wrap(consumer, 'run', wrapRun)
    return consumer
  }
}

function wrapRun(shim, fn) {
  const agent = shim.agent
  return function wrappedRun() {
    const runArgs = shim.argsToArray.apply(shim, arguments)
    const brokers = this[kafkaCtx].brokers
    if (runArgs?.[0]?.eachBatch) {
      runArgs[0].eachBatch = shim.wrap(
        runArgs[0].eachBatch,
        function wrapEachBatch(shim, eachBatch) {
          return function wrappedEachBatch() {
            recordMethodMetric({ agent, name: 'eachBatch' })
            recordLinkingMetrics({
              agent,
              brokers,
              topic: arguments[0].batch.topic,
              producer: false
            })
            return eachBatch.apply(this, arguments)
          }
        }
      )
    }
    return fn.apply(this, runArgs)
  }
}

/**
 * Wrapped of message handler that passes in consumer and recordMethodMetric.
 * We do not want to bind this as this gets called with the appropriate binding
 * in message-shim
 *
 * @param {object} params to function
 * @param {object} params.consumer consumer being instrumented
 * @returns {function} message handler for setting metrics and spec for the consumer transaction
 */
function handler({ consumer }) {
  /**
   * Message handler that extracts the topic and headers from message being consumed.
   *
   * This also sets some metrics for byte length of message, and number of messages.
   * Lastly, adds tx attributes for byteCount and clientId
   *
   * @param {MessageShim} shim instance of shim
   * @param {Array} args arguments passed to the `eachMessage` function of the `consumer.run`
   * @param {Transaction} tx active transaction
   * @returns {MessageSpec} spec for message handling
   */
  return function messageHandler(shim, args, tx) {
    recordMethodMetric({ agent: shim.agent, name: 'eachMessage' })

    const [data] = args
    const { topic } = data

    recordLinkingMetrics({
      agent: shim.agent,
      brokers: consumer[kafkaCtx].brokers,
      topic,
      producer: false
    })

    if (tx) {
      const byteLength = data?.message.value?.byteLength
      const metricPrefix = `Message/Kafka/Topic/Named/${topic}/Received`
      // This will always be 1
      tx.metrics.getOrCreateMetric(`${metricPrefix}/Messages`).recordValue(1)
      if (byteLength) {
        tx.metrics.measureBytes(`${metricPrefix}/Bytes`, byteLength)
        tx.trace.attributes.addAttribute(
          DESTINATIONS.TRANS_SCOPE,
          'kafka.consume.byteCount',
          byteLength
        )
      }
      if (consumer?.[kafkaCtx]) {
        tx.trace.attributes.addAttribute(
          DESTINATIONS.TRANS_EVENT,
          'kafka.consume.client_id',
          consumer[kafkaCtx].clientId
        )
      }
    }

    return new MessageSpec({
      destinationType: 'Topic/Consume',
      destinationName: data?.topic,
      headers: data?.message?.headers
    })
  }
}
