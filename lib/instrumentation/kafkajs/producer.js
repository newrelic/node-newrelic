/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { MessageSpec } = require('../../shim/specs')
const getByPath = require('../../util/get')
const NR_PRODUCE_BROKERS = Symbol('nr:kafka_produce_brokers')

module.exports = function instrumentProducer({ shim, kafkajs, recordMethodMetric }) {
  const { agent } = shim

  shim.wrap(kafkajs, 'Kafka', function nrConstructorWrapper(shim, orig) {
    return function nrConstructor() {
      const params = shim.argsToArray.apply(shim, arguments)
      // eslint-disable-next-line new-cap
      const instance = new orig(...params)
      instance[NR_PRODUCE_BROKERS] = params[0].brokers

      shim.wrap(instance, 'producer', nrProducerWrapper)

      return instance
    }
  })

  function nrProducerWrapper(shim, orig) {
    return function nrProducer() {
      const params = shim.argsToArray.apply(shim, arguments)
      const producer = orig.apply(this, params)
      producer[NR_PRODUCE_BROKERS] = this[NR_PRODUCE_BROKERS]

      // The `.producer()` method returns an object with `send` and `sendBatch`
      // methods. The `send` method is merely a wrapper around `sendBatch`, but
      // we cannot simply wrap `sendBatch` because the `send` method does not
      // use the object scoped instance (i.e. `this.sendBatch`); it utilizes
      // the closure scoped instance of `sendBatch`. So we must wrap each
      // method.
      shim.recordProduce(producer, 'send', nrSend)
      shim.recordProduce(producer, 'sendBatch', nrSendBatch)

      return producer
    }
  }

  function nrSend(shim, fn, name, args) {
    recordMethodMetric({ agent, name })
    const data = args[0]

    recordProduceMetrics({ agent, brokers: this[NR_PRODUCE_BROKERS], topic: data.topic })

    return new MessageSpec({
      promise: true,
      destinationName: data.topic,
      destinationType: shim.TOPIC,
      messageHeaders: (inject) => {
        return data.messages.map((msg) => {
          if (msg.headers) {
            return inject(msg.headers)
          }
          msg.headers = {}
          return inject(msg.headers)
        })
      }
    })
  }

  function nrSendBatch(shim, fn, name, args) {
    recordMethodMetric({ agent, name })
    const data = args[0]
    const firstMessage = getByPath(data, 'topicMessages[0].messages[0]')

    recordProduceMetrics({
      agent,
      brokers: this[NR_PRODUCE_BROKERS],
      topic: data.topicMessages[0].topic
    })

    if (firstMessage) {
      firstMessage.headers = firstMessage.headers ?? {}
    }

    return new MessageSpec({
      promise: true,
      destinationName: data.topicMessages[0].topic,
      destinationType: shim.TOPIC,
      messageHeaders: (inject) => {
        return data.topicMessages.map((tm) => {
          return tm.messages.map((m) => {
            if (m.headers) {
              return inject(m.headers)
            }
            m.headers = {}
            return inject(m.headers)
          })
        })
      }
    })
  }

  function recordProduceMetrics({ agent, brokers, topic }) {
    for (const broker of brokers) {
      agent.metrics
        .getOrCreateMetric(`MessageBroker/Kafka/Nodes/${broker}/Produce/Named/${topic}`)
        .incrementCallCount()
    }
  }
}
