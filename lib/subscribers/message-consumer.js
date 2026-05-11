/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('./base')
const tools = require('#agentlib/subscribers/message-consumer-tools.js')

/**
 * @typedef {object} MessageConsumerParams
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {string} packageName The package name being instrumented.
 * This is what a developer would provide to the `require` function.
 * @property {string} channelName A unique name for the diagnostics channel
 * that will be created and monitored.
 * @property {string} system canonical mapping of system(i.e. - Kafka, RabbitMq, SNS, SQS)
 * @property {string} type destinationType: Exchange, Queue, Topic
 * @property {number} callback if consumer is callback based, indicates index of callback
 * @property {string} transport identifier of the transport(see Transaction.TRANSPORT_TYPES)
 */

/**
 * A set of key-value pairs that define the metadata we are interested in
 * during the execution of a consumer function.
 *
 * @typedef {object} ConsumerParameters
 * @property {string} host The FQDN or IP address of the remote host to
 * consume messages from.
 * @property {string|number} port The listening port of the remote host.
 * @property {string} routing_key A string that defines the partition the
 * consumer is targeting on the remote system.
 * @property {string} queue The name of the target queue the consumer is
 * targeting on the remote system.
 */

/**
 * A message consumer does the following:
 * 1. Calling consume creates a segment if in an active transaction
 * 2. For every consumption, typically registered as a callback, it will create
 * a transaction of type `message`, create a baseSegment, add both segment and
 * trace attributes, and assign the `message-transaction` timeslice metrics
 *
 * @property {ConsumerParameters} consumerParameters A key-value store of
 * metadata associated with the current consumer operation. These pairs are
 * typically sourced from the message being processed, i.e. they come from the
 * segment associated with the registered consumer function.
 * @property {object} headers A key-value set of request headers used while
 * communicating with the remote system. This will typically be set by
 * an extension class when the start of the consumer function happens.
 * @property {object} parameters A key-value store of metadata associated with
 * the current messaging operation. These pairs can be added to the
 * {@link TraceSegment} via the {@link #addAttributes} method. These parameters
 * are sourced from the segment that registers the consumer function.
 */
class MessageConsumerSubscriber extends Subscriber {
  consumerParameters = {}
  headers = {}
  parameters = {}

  /**
   * @param {MessageConsumerParams} params constructor params
   */
  constructor({ agent, logger, packageName, channelName, system, type, callback, transport }) {
    super({ agent, logger, packageName, channelName })
    this.system = system
    this.type = type
    this.callback = callback
    this.transport = transport
    this.events = ['asyncStart', 'asyncEnd']
  }

  /**
   * Used to create the consume segment if in an active transaction
   * @param {object} data event passed to handler
   * @param {Context} ctx agent context
   * @returns {Context} new context or existing if not in active transaction
   */
  handler(data, ctx) {
    return this.createSegment({
      name: this.segmentName,
      ctx
    })
  }

  /**
   * Used to add parameters to the consume segment
   *
   * @param {TraceSegment} segment to add attributes to
   */
  addAttributes(segment) {
    for (const [key, value] of Object.entries(this.parameters)) {
      segment.addAttribute(key, value)
    }
  }

  /**
   * Checks the result of the message handler.
   * If it's a promise, waits for it to resolve before ending transaction.
   * This ensures that the transaction stays active until the promise resolves.
   * @param {object} data the data associated with the `asyncEnd` event
   */
  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    const result = data.cbResult
    tools.handleResult(result, ctx?.transaction)
  }

  enable() {
    super.enable()
    this.channel.asyncStart.bindStore(
      this.store,
      () => tools.initiateTransaction(this.agent)
    )
  }

  disable() {
    super.disable()
    this.channel.asyncStart.unbindStore(this.store)
  }

  /**
   * Used to create a transaction for every consumption callback.
   *
   */
  asyncStart() {
    tools.startConsumeSegment({
      agent: this.agent,
      consumerParameters: this.consumerParameters,
      headers: this.headers,
      txName: this.name,
      transport: this.transport
    })
  }

  /**
   * Used to name the transaction for every consumption callback.
   *
   * @returns {string} partial transaction name
   */
  get name() {
    let name = `${this.system}/${this.type}`
    if (this.destination) {
      name += `/Named/${this.destination}`
    } else {
      name += '/Temp'
    }
    return name
  }
}

module.exports = MessageConsumerSubscriber
