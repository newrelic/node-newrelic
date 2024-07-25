/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { MessageSpec, MessageSubscribeSpec, RecorderSpec } = require('../../shim/specs')
const CHANNEL_METHODS = [
  'close',
  'open',
  'assertQueue',
  'checkQueue',
  'deleteQueue',
  'bindQueue',
  'unbindQueue',
  'assertExchange',
  'checkExchange',
  'deleteExchange',
  'bindExchange',
  'unbindExchange',
  'cancel',
  'prefetch',
  'recover'
]
const {
  describeMessage,
  setCallback,
  parseConnect,
  getParametersFromMessage,
  TEMP_RE
} = require('./utils')

/**
 *
 * Instruments the relevant channel callback_model or channel_model.
 *
 * @param {Shim} shim instance of shim
 * @param {object} Model either channel or callback model
 * @param {boolean} promiseMode is this promise based?
 */
module.exports = function wrapModel(shim, Model, promiseMode) {
  if (!Model.Channel?.prototype) {
    shim.logger.debug(
      `Could not get ${promiseMode ? 'promise' : 'callback'} model Channel to instrument.`
    )
    return
  }

  const proto = Model.Channel.prototype
  if (shim.isWrapped(proto.consume)) {
    shim.logger.trace(`${promiseMode ? 'promise' : 'callback'} model already instrumented.`)
    return
  }

  recordChannelMethods({ shim, proto, promiseMode })
  recordPurge({ shim, proto, promiseMode })
  recordGet({ shim, proto, promiseMode })
  recordConsume({ shim, proto, promiseMode })
}

/**
 * Record spans for common methods on channel
 *
 * @param {Channel} proto prototype of Model.Channel
 */
function recordChannelMethods({ shim, proto, promiseMode }) {
  shim.record(proto, CHANNEL_METHODS, function recordChannelMethod(shim, fn, name) {
    return new RecorderSpec({
      name: 'Channel#' + name,
      callback: setCallback(shim, promiseMode),
      promise: promiseMode
    })
  })
}

function recordPurge({ shim, proto, promiseMode }) {
  shim.recordPurgeQueue(proto, 'purgeQueue', function purge(shim, fn, name, args) {
    let queue = args[0]
    if (TEMP_RE.test(queue)) {
      queue = null
    }
    return new MessageSpec({
      queue,
      promise: promiseMode,
      callback: setCallback(shim, promiseMode)
    })
  })
}

function recordGet({ shim, proto, promiseMode }) {
  shim.recordConsume(proto, 'get', function wrapGet() {
    const { host, port } = parseConnect(this?.connection?.stream)
    return new MessageSpec({
      destinationName: shim.FIRST,
      callback: setCallback(shim, promiseMode),
      promise: promiseMode,
      after: function handleConsumedMessage({ shim, result, args, segment }) {
        if (!shim.agent.config.message_tracer.segment_parameters.enabled) {
          shim.logger.trace('Not capturing segment parameters')
          return
        }

        // the message is the param when using the promised based model
        const message = promiseMode ? result : args?.[1]
        if (!message) {
          shim.logger.trace('No results from consume.')
          return null
        }
        const parameters = getParametersFromMessage({ message, host, port })
        shim.copySegmentParameters(segment, parameters)
      }
    })
  })
}

function recordConsume({ shim, proto, promiseMode }) {
  shim.recordSubscribedConsume(proto, 'consume', function consume() {
    const { host, port } = parseConnect(this?.connection?.stream)
    return new MessageSubscribeSpec({
      name: 'amqplib.Channel#consume',
      queue: shim.FIRST,
      consumer: shim.SECOND,
      promise: promiseMode,
      parameters: { host, port },
      callback: promiseMode ? null : shim.FOURTH,
      messageHandler: describeMessage({ host, port })
    })
  })
}
