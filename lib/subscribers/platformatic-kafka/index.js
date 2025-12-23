/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: add test to cover once this is resolved https://github.com/platformatic/kafka/issues/155

const recorder = require('#agentlib/metrics/recorders/generic.js')
const {
  TracingChannelSubscription,
  TracingChannelSubscriber
} = require('../tracing-channel-subscriber.js')

const connectsSub = new TracingChannelSubscription({
  channel: 'tracing:plt:kafka:connections:connects',
  start(event) {
    // TODO: is this invoked for every broker that was defined during
    // initialization? If so, should we be creating a segment for each broker
    // send?

    const context = this.agent.tracer.getContext()
    const { segment, transaction } = context

    if (!segment || !transaction) {
      this.logger.trace('Not capturing connection details due to missing transaction.')
      return
    }

    const { topic, clientKind } = context.extras
    const { host: broker } = event
    this.agent.metrics
      .getOrCreateMetric(`MessageBroker/Kafka/Nodes/${broker}/${clientKind}/${topic}`)
      .incrementCallCount()

    const externalSegment = this.agent.tracer.createSegment({
      name: 'connect',
      parent: segment,
      recorder,
      transaction
    })
    externalSegment.shimId = this.id
    externalSegment.start()

    return context.enterSegment({ segment: externalSegment })
  },
  error(event) {
    const context = this.agent.tracer.getContext()
    context?.transaction?.agent.errors.add(context.transaction, event.error)
  }
})

const producerSendsSub = new TracingChannelSubscription({
  channel: 'tracing:plt:kafka:producer:sends',
  start(event) {
    const context = this.agent.tracer.getContext()
    const { segment, transaction } = context

    if (!segment || !transaction) {
      this.logger.trace('Not recording producer send due to missing transaction.')
      return
    }

    // TODO: this module only has a single `.send` method that works like
    // kafkajs's `sendBatch` method. We should probably figure out a better way
    // to generate metrics for batches.
    const firstMessage = event?.options?.messages?.[0]
    const topic = firstMessage?.topic ?? 'unknown'

    // Order of operations is:
    // 1. `producer.send` is invoked which gets us to here
    // 2. Connection is made to the remote system.
    // 3. The `connections:connects` channel is triggered.
    // 4. In the other channel, we need to the topic in order to generate the
    // linking metric. So we have to store that information in the context.
    context.extras.topic = topic
    context.extras.clientKind = 'Produce'

    const externalSegment = this.agent.tracer.createSegment({
      name: `MessageBroker/Kafka/topic/Produce/Named/${topic}`,
      parent: segment,
      recorder,
      transaction
    })
    segment.opaque = transaction.opaque
    externalSegment.shimId = this.id
    externalSegment.type = 'message'
    externalSegment.start()

    return context.enterSegment({ segment: externalSegment })
  },
  end() {
    this.touch()
  },

  asyncStart() {
    // TODO: are we getting the correct context? Do we need to do the crazy
    // `isActiveTx` context propagation as we had to do in other cases?
    this.touch()
  },

  asyncEnd() {
    this.touch()
  }
})

class PlatformaticKafkaSubscriber extends TracingChannelSubscriber {
  constructor({ agent, logger, ...rest }) {
    super({ agent, logger, packageName: '@platformatic/kafka', ...rest })
    this.subscriptions = [
      connectsSub,
      producerSendsSub
    ]
  }

  /**
   * Update the current context's timing tracker.
   */
  touch() {
    const context = this.agent.tracer.getContext()
    context?.segment?.touch()
  }
}

module.exports = PlatformaticKafkaSubscriber
