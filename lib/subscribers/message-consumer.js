/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('./base')
const Transaction = require('#agentlib/transaction/index.js')
const messageTransactionRecorder = require('#agentlib/metrics/recorders/message-transaction.js')
const isString = require('#agentlib/util/is-string.js')

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
 * A message consumer does the following:
 *  1. Calling consume creates a segment if in an active transaction
 *  2. For every consumption, typically registered as a callback, it will create a transaction of type `message`, create a baseSegment, add both segment and trace attributes, and assign the `message-transaction` timeslice metrics
 */
class MessageConsumerSubscriber extends Subscriber {
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
    if (typeof result?.then === 'function') {
      const prom = Promise.resolve(result)
      prom.finally(() => {
        ctx?.transaction?.end()
      })
    } else {
      ctx?.transaction?.end()
    }
  }

  enable() {
    super.enable()
    this.channel.asyncStart.bindStore(this.store, (data) => {
      const ctx = this.agent.tracer.getContext()
      const transaction = new Transaction(this.agent)
      transaction.type = 'message'
      return ctx.enterTransaction(transaction)
    })
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
    const ctx = this.agent.tracer.getContext()
    const tx = ctx.transaction
    tx.setPartialName(this.name)
    // Note: this is not using `Subscriber.createSegment`
    // this is because it enters the segment and returns a new ctx
    // since this isn't in bindStore entering a new context doesn't
    // bind it to the store
    tx.baseSegment = this.agent.tracer.createSegment({
      name: tx.getFullName(),
      recorder: messageTransactionRecorder,
      parent: tx.trace.root,
      transaction: tx
    })
    tx.baseSegment.start()

    this.addConsumeParameters(tx)

    if (this.headers) {
      tx.addDtCatHeaders({ headers: this.headers, transport: this.transport })
    }
  }

  /**
   * Used to add parameters to trace and baseSegment of a consumption callback.
   *
   * @param {Transaction} tx to add attributes to
   */
  addConsumeParameters(tx) {
    for (const [key, value] of Object.entries(this.consumerParameters)) {
      if (['host', 'port'].includes(key)) {
        tx.baseSegment.addAttribute(key, value)
      } else {
        tx.trace.attributes.addAttribute(Transaction.DESTINATIONS.NONE, `message.parameters.${key}`, value)
        tx.baseSegment.attributes.addAttribute(Transaction.DESTINATIONS.NONE, `message.parameters.${key}`, value)
      }

      if (key === 'routing_key' && this.config.high_security === false) {
        tx.trace.attributes.addAttribute(Transaction.DESTINATIONS.TRANS_COMMON, 'message.routingKey', value)
        tx.baseSegment.addSpanAttribute('message.routingKey', value)
      }
    }
    if (isString(this.queue) && this.config.high_security === false) {
      tx.trace.attributes.addAttribute(Transaction.DESTINATIONS.TRANS_COMMON, 'message.queueName', this.queue)
      tx.baseSegment.addSpanAttribute('message.queueName', this.queue)
    }
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
