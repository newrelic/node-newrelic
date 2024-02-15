/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const ATTR_DESTS = require('../../config/attribute-filter').DESTINATIONS
const messageTransactionRecorder = require('../../metrics/recorders/message-transaction')
const props = require('../../util/properties')
const specs = require('../specs')
module.exports = createSubscriberWrapper

/**
 * Derives the transaction name based on the spec passed in
 *
 * @private
 * @param {MessageShim} shim instance of shim
 * @param {specs.MessageSubscribeSpec} msgDesc spec for function
 * @returns {string} constructed name for transaction
 */
function _nameMessageTransaction(shim, msgDesc) {
  let name = shim._metrics.LIBRARY + '/' + (msgDesc.destinationType || shim.EXCHANGE) + '/'

  if (msgDesc.destinationName) {
    name += shim._metrics.NAMED + msgDesc.destinationName
  } else {
    name += shim._metrics.TEMP
  }

  return name
}

/**
 * Wrapper for subscribing to a queue.
 *
 * @private
 * @param {object} params to function
 * @param {MessageShim} params.shim instance of shim
 * @param {Function} params.fn subscriber function
 * @param {specs.MessageSubscribeSpec} params.spec spec for subscriber
 * @param {boolean} params.destNameIsArg flag to state if destination is an argument
 * @returns {Function} wrapped subscribe function
 */
function createSubscriberWrapper({ shim, fn, spec, destNameIsArg }) {
  return function wrappedSubscribe() {
    const args = shim.argsToArray.apply(shim, arguments)
    const queueIdx = shim.normalizeIndex(args.length, spec.queue)
    const consumerIdx = shim.normalizeIndex(args.length, spec.consumer)
    const queue = queueIdx === null ? null : args[queueIdx]
    let destinationName = null

    if (destNameIsArg) {
      const destNameIdx = shim.normalizeIndex(args.length, spec.destinationName)
      if (destNameIdx !== null) {
        destinationName = args[destNameIdx]
      }
    }

    if (consumerIdx !== null) {
      args[consumerIdx] = shim.wrap(
        args[consumerIdx],
        makeWrapConsumer({ spec, queue, destinationName, destNameIsArg })
      )
    }

    return fn.apply(this, args)
  }
}

/**
 * @private
 * @param {object} params to function
 * @param {specs.MessageSubscribeSpec} params.spec The message descriptor.
 * @param {string} params.queue name of queue
 * @param {string} params.destinationName destination of message in consume function
 * @param {boolean} params.destNameIsArg flag to state if destination is an argument
 * @returns {Function} wrapped consumer function
 */
function makeWrapConsumer({ spec, queue, destinationName, destNameIsArg }) {
  const msgDescDefaults = new specs.MessageSubscribeSpec(spec)
  if (destNameIsArg && destinationName != null) {
    msgDescDefaults.destinationName = destinationName
  }
  if (queue != null) {
    msgDescDefaults.queue = queue
  }

  return function wrapConsumer(shim, consumer, cName) {
    if (!shim.isFunction(consumer)) {
      return consumer
    }

    const consumerWrapper = createConsumerWrapper({ shim, consumer, cName, spec: msgDescDefaults })
    return shim.bindCreateTransaction(
      consumerWrapper,
      new specs.TransactionSpec({
        type: shim.MESSAGE,
        nest: true
      })
    )
  }
}

/**
 * Handler for the transaction that is being created when consuming messages
 *
 * @private
 * @param {object} params to function
 * @param {MessageShim} params.shim instance of shim
 * @param {specs.MessageSubscribeSpec} params.spec spec for function
 * @param {Function} params.consumer function for consuming message
 * @param {string} params.cName name of consumer function
 * @returns {Function} handler for the transaction being created
 */
function createConsumerWrapper({ shim, spec, consumer, cName }) {
  return function createConsumeTrans() {
    // If there is no transaction or we're in a pre-existing transaction,
    // then don't do anything. Note that the latter should never happen.
    const args = shim.argsToArray.apply(shim, arguments)
    const tx = shim.tracer.getTransaction()

    if (!tx || tx.baseSegment) {
      shim.logger.debug({ transaction: !!tx }, 'Failed to start message transaction.')
      return consumer.apply(this, args)
    }

    const msgDesc = spec.messageHandler.call(this, shim, consumer, cName, args)

    // If message could not be handled, immediately kill this transaction.
    if (!msgDesc) {
      shim.logger.debug('No description for message, cancelling transaction.')
      tx.setForceIgnore(true)
      tx.end()
      return consumer.apply(this, args)
    }

    // Derive the transaction name.
    shim.setDefaults(msgDesc, spec)
    const txName = _nameMessageTransaction(shim, msgDesc)
    tx.setPartialName(txName)
    tx.baseSegment = shim.createSegment({
      name: tx.getFullName(),
      recorder: messageTransactionRecorder
    })

    // Add would-be baseSegment attributes to transaction trace
    for (const key in msgDesc.parameters) {
      if (props.hasOwn(msgDesc.parameters, key)) {
        tx.trace.attributes.addAttribute(
          ATTR_DESTS.NONE,
          'message.parameters.' + key,
          msgDesc.parameters[key]
        )

        tx.baseSegment.attributes.addAttribute(
          ATTR_DESTS.NONE,
          'message.parameters.' + key,
          msgDesc.parameters[key]
        )
      }
    }

    // If we have a routing key, add it to the transaction. Note that it is
    // camel cased here, but snake cased in the segment parameters.
    if (!shim.agent.config.high_security) {
      if (msgDesc.routingKey) {
        tx.trace.attributes.addAttribute(
          ATTR_DESTS.TRANS_COMMON,
          'message.routingKey',
          msgDesc.routingKey
        )

        tx.baseSegment.addSpanAttribute('message.routingKey', msgDesc.routingKey)
      }
      if (shim.isString(msgDesc.queue)) {
        tx.trace.attributes.addAttribute(
          ATTR_DESTS.TRANS_COMMON,
          'message.queueName',
          msgDesc.queue
        )

        tx.baseSegment.addSpanAttribute('message.queueName', msgDesc.queue)
      }
    }
    if (msgDesc.headers) {
      shim.handleMqTracingHeaders(msgDesc.headers, tx.baseSegment, shim._transportType)
    }

    shim.logger.trace('Started message transaction %s named %s', tx.id, txName)

    // Execute the original function and attempt to hook in the transaction
    // finish.
    let ret = null
    try {
      ret = shim.applySegment(consumer, tx.baseSegment, true, this, args)
    } finally {
      if (shim.isPromise(ret)) {
        shim.logger.trace('Got a promise, attaching tx %s ending to promise', tx.id)
        ret = shim.interceptPromise(ret, endTransaction)
      } else if (!tx.handledExternally) {
        // We have no way of knowing when this transaction ended! ABORT!
        shim.logger.trace('Immediately ending message tx %s', tx.id)
        setImmediate(endTransaction)
      }
    }

    return ret

    /**
     * finalizes transaction name and ends transaction
     */
    function endTransaction() {
      tx.finalizeName(null) // Use existing partial name.
      tx.end()
    }
  }
}
