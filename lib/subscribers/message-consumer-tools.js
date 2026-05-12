/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// This file exists specifically so that the `kafkajs` instrumentation, and
// possibly others, can reuse the core logic of the message consumer
// abstraction. Unfortunately, the design of that module requires this.

module.exports = {
  addConsumeParametersToTransaction,
  handleResult,
  initiateTransaction,
  startConsumeSegment
}

const Transaction = require('#agentlib/transaction/index.js')
const messageTransactionRecorder = require('#agentlib/metrics/recorders/message-transaction.js')
const isString = require('#agentlib/util/is-string.js')

/**
 * Adds parameters used during the execution of the consumer function to the
 * given transaction.
 *
 * @param {object} params Function parameters.
 * @param {ConsumerParameters} params.parameters Key value has of parameters
 * to add.
 * @param {Transaction} params.tx The transaction to add the parameters to.
 * @param {object} params.agentConfig The current configuration for the agent.
 */
function addConsumeParametersToTransaction({
  parameters = {},
  tx,
  agentConfig
}) {
  for (const [key, value] of Object.entries(parameters)) {
    if (['host', 'port'].includes(key)) {
      tx.baseSegment.addAttribute(key, value)
    } else {
      tx.trace.attributes.addAttribute(
        Transaction.DESTINATIONS.NONE,
        `message.parameters.${key}`,
        value
      )
      tx.baseSegment.attributes.addAttribute(
        Transaction.DESTINATIONS.NONE,
        `message.parameters.${key}`,
        value
      )
    }

    if (key === 'routing_key' && agentConfig.high_security === false) {
      tx.trace.attributes.addAttribute(
        Transaction.DESTINATIONS.TRANS_COMMON,
        'message.routingKey',
        value
      )
      tx.baseSegment.addSpanAttribute('message.routingKey', value)
    }
  }
  if (isString(parameters.queue) && agentConfig.high_security === false) {
    const { queue } = parameters
    tx.trace.attributes.addAttribute(
      Transaction.DESTINATIONS.TRANS_COMMON,
      'message.queueName',
      queue
    )
    tx.baseSegment.addSpanAttribute('message.queueName', queue)
  }
}

/**
 * When a consumer method finishes, it returns either a promise or some
 * traditional object. We need to determine which one we have, and then
 * end the transaction associated with the consumer method. This utility
 * function does this work.
 *
 * @param {Promise|*} result The consumer method's returned entity.
 * @param {Transaction} transaction The transaction encapsulating the
 * consumer method operation.
 *
 * @returns {Promise|Transaction} The result of ending the transaction.
 */
function handleResult(result, transaction) {
  if (typeof result?.then === 'function') {
    const localPromise = Promise.resolve(result)
    return localPromise.finally(() => transaction?.end())
  }
  return transaction.end()
}

/**
 * Creates a new message {@link Transaction}, activates it, and returns
 * the context associated with the transaction.
 *
 * @param {Agent} agent The current agent instance.
 *
 * @returns {Context} A new context instance.
 */
function initiateTransaction(agent) {
  const ctx = agent.tracer.getContext()
  const tx = new Transaction(agent)
  tx.type = 'message'
  return ctx.enterTransaction(tx)
}

/**
 * When the consumer function is invoked, this function should be used to
 * start the {@link TraceSegment} for the operations of the consumer.
 *
 * @param {object} params Function parameters.
 * @param {Agent} params.agent The current agent instance.
 * @param {ConsumerParameters} params.consumerParameters The parameters the
 * consumer function is using for communicating with the remote system.
 * @param {object} params.headers Set of request headers the consumer
 * function uses during its operation. May be empty.
 * @param {string} params.txName The fully resolved transaction name for
 * the current segment, e.g.
 * `OtherTransaction/Message/Kafka/Topic/Consume/Named/topic-whatever`.
 * @param {string} params.transport The target transport name as defined
 * by {@link Transaction#TRANSPORT_TYPES}.
 *
 * @returns {Context} The current context.
 */
function startConsumeSegment({
  agent,
  consumerParameters,
  headers,
  txName,
  transport
}) {
  const ctx = agent.tracer.getContext()
  const tx = ctx.transaction

  tx.setPartialName(txName)
  // Note: this is not using `Subscriber.createSegment`.
  // This is because `Subscriber.createSegment` enters the segment and
  // returns a new ctx. Since this isn't in bindStore, entering a new
  // context doesn't bind it to the store.
  tx.baseSegment = agent.tracer.createSegment({
    name: tx.getFullName(),
    recorder: messageTransactionRecorder,
    parent: tx.trace.root,
    transaction: tx
  })
  tx.baseSegment.start()

  addConsumeParametersToTransaction({
    parameters: consumerParameters,
    agentConfig: agent.config,
    tx
  })

  if (headers != null) {
    tx.addDtHeaders({ headers, transport })
  }

  return ctx
}
