/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  OperationSpec,
  params: { DatastoreParameters }
} = require('../../shim/specs')
const wrapModel = require('./channel-model')
const { setCallback, parseConnectionArgs } = require('./utils')
const wrapChannel = require('./channel')
const { amqpConnection } = require('../../symbols')

module.exports.instrumentPromiseAPI = instrumentChannelAPI
module.exports.instrumentCallbackAPI = instrumentCallbackAPI

/**
 * Register all the necessary instrumentation when using
 * promise based methods
 *
 * @param {Shim} shim instance of shim
 * @param {object} amqp amqplib object
 */
function instrumentChannelAPI(shim, amqp) {
  instrumentAMQP(shim, amqp, true)
  // 👀 take note the model is channel not callback 👀
  const model = shim.require('./lib/channel_model')
  wrapModel(shim, model, true)
}

/**
 * Register all the necessary instrumentation when using
 * callback based methods
 *
 * @param {Shim} shim instance of shim
 * @param {object} amqp amqplib object
 */
function instrumentCallbackAPI(shim, amqp) {
  instrumentAMQP(shim, amqp, false)
  // 👀 take note the model is callback not channel 👀
  const model = shim.require('./lib/callback_model')
  wrapModel(shim, model, false)
}

/**
 *
 * Instruments the connect method and channel prototype of amqplib
 *
 * @param {Shim} shim instance of shim
 * @param {object} amqp amqplib object
 * @param {boolean} promiseMode is this promise based?
 * @returns {void}
 */
function instrumentAMQP(shim, amqp, promiseMode) {
  if (!amqp || !amqp.connect) {
    shim.logger.debug("This module is not the amqplib we're looking for.")
    return
  }

  if (shim.isWrapped(amqp.connect)) {
    shim.logger.trace('This module has already been instrumented, skipping.')
    return
  }
  shim.setLibrary(shim.RABBITMQ)

  wrapConnect(shim, amqp, promiseMode)
  wrapChannel(shim)
}

/**
 *
 * Instruments the connect method
 * We have to both wrap and record because
 * we need the host/port for all subsequent calls on the model/channel
 * but record only completes in an active transaction
 *
 * @param {Shim} shim instance of shim
 * @param {object} amqp amqplib object
 * @param {boolean} promiseMode is this promise based?
 */
function wrapConnect(shim, amqp, promiseMode) {
  shim.wrap(amqp, 'connect', function wrapConnect(shim, connect) {
    return function wrappedConnect() {
      const args = shim.argsToArray.apply(shim, arguments)
      const [connArgs] = args
      const params = parseConnectionArgs({ shim, connArgs })
      const cb = args[args.length - 1]
      if (!promiseMode) {
        args[args.length - 1] = function wrappedCallback() {
          const cbArgs = shim.argsToArray.apply(shim, arguments)
          const [, c] = cbArgs
          c.connection[amqpConnection] = params
          return cb.apply(this, cbArgs)
        }
      }

      const result = connect.apply(this, args)
      if (promiseMode) {
        return result.then((c) => {
          c.connection[amqpConnection] = params
          return c
        })
      }
      return result
    }
  })

  shim.record(amqp, 'connect', function recordConnect(shim, connect, name, args) {
    const [connArgs] = args
    const params = parseConnectionArgs({ shim, connArgs })
    return new OperationSpec({
      name: 'amqplib.connect',
      callback: setCallback(shim, promiseMode),
      promise: promiseMode,
      parameters: new DatastoreParameters({
        host: params.host,
        port_path_or_id: params.port
      })
    })
  })
}
