/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const ATTR_DESTS = require('../../config/attribute-filter').DESTINATIONS
const messageTransactionRecorder = require('../../metrics/recorders/message-transaction')
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
 * @param {string} params.name function name
 * @returns {Function} wrapped subscribe function
 */
function createSubscriberWrapper({ shim, fn, spec, name }) {
  return function wrappedSubscribe(...args) {
    if (shim.isFunction(spec)) {
      spec = spec.call(this, shim, fn, name, args)
    }

    // Make sure our spec has what we need.
    if (!shim.isFunction(spec.messageHandler)) {
      shim.logger.debug('spec.messageHandler should be a function')
      return fn.apply(this, args)
    } else if (!shim.isNumber(spec.consumer)) {
      shim.logger.debug('spec.consumer is required for recordSubscribedConsume')
      return fn.apply(this, args)
    }

    const destNameIsArg = shim.isNumber(spec.destinationName)

    const queueIdx = shim.normalizeIndex(args.length, spec.queue)
    const consumerIdx = shim.normalizeIndex(args.length, spec.consumer)
    if (consumerIdx === null) {
      shim.logger.debug('Could not find consumer argument for subscribed consume.')
      return fn.apply(this, args)
    }
    const queue = queueIdx === null ? null : args[queueIdx]
    let destinationName = null

    if (destNameIsArg) {
      const destNameIdx = shim.normalizeIndex(args.length, spec.destinationName)
      if (destNameIdx !== null) {
        destinationName = args[destNameIdx]
      }
    }

    if (spec.functions) {
      for (const name of spec.functions) {
        // only wrap the function if it exists on consumer
        if (args[consumerIdx][name]) {
          args[consumerIdx][name] = shim.wrap(
            args[consumerIdx][name],
            // bind the proper this scope into the consumers
            makeWrapConsumer.call(this, { spec, queue, destinationName, destNameIsArg })
          )
        }
      }
    } else {
      args[consumerIdx] = shim.wrap(
        args[consumerIdx],
        makeWrapConsumer.call(this, { spec, queue, destinationName, destNameIsArg })
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
  if (destNameIsArg && destinationName != null) {
    spec.destinationName = destinationName
  }
  if (queue != null) {
    spec.queue = queue
  }

  return function wrapConsumer(shim, consumer) {
    if (!shim.isFunction(consumer)) {
      return consumer
    }

    const consumerWrapper = createConsumerWrapper.call(this, { shim, consumer, spec })
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
 * @returns {Function} handler for the transaction being created
 */
function createConsumerWrapper({ shim, spec, consumer }) {
  return function createConsumeTrans(...args) {
    // If there is no transaction, or we're in a pre-existing transaction,
    // then don't do anything. Note that the latter should never happen.
    const tx = shim.tracer.getTransaction()

    if (!tx || tx.baseSegment) {
      shim.logger.debug({ transaction: !!tx }, 'Failed to start message transaction.')
      return consumer.apply(this, args)
    }

    const msgDesc = spec.messageHandler.call(this, shim, args, tx)

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
      recorder: messageTransactionRecorder,
      parent: tx.trace.root
    })

    // Add would-be baseSegment attributes to transaction trace
    for (const key in msgDesc.parameters) {
      if (['host', 'port'].includes(key)) {
        tx.baseSegment.addAttribute(key, msgDesc.parameters[key])
      } else {
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
      shim.handleMqTracingHeaders(msgDesc.headers, tx.baseSegment, shim._transportType, tx)
    }

    shim.logger.trace('Started message transaction %s named %s', tx.id, txName)

    // Execute the original function and attempt to hook in the transaction
    // finish.
    let ret = shim.applySegment(consumer, tx.baseSegment, true, this, args)

    if (shim.isPromise(ret)) {
      shim.logger.trace('Got a promise, attaching tx %s ending to promise', tx.id)

      ret = shim.interceptPromise(ret, endTransaction)
    } else if (!tx.handledExternally) {
      // We have no way of knowing when this transaction ended! ABORT!
      shim.logger.trace('Immediately ending message tx %s', tx.id)
      setImmediate(endTransaction)
    }

    return ret

    /**
     * finalizes transaction name and ends transaction
     */
    function endTransaction() {
      tx.end()
    }
  }
}
