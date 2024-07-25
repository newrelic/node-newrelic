/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  OperationSpec,
  params: { DatastoreParameters }
} = require('../../shim/specs')
const url = require('url')
const wrapModel = require('./channel-model')
const { setCallback } = require('./utils')
const wrapChannel = require('./channel')

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
 *
 * @param {Shim} shim instance of shim
 * @param {object} amqp amqplib object
 * @param {boolean} promiseMode is this promise based?
 */
function wrapConnect(shim, amqp, promiseMode) {
  shim.record(amqp, 'connect', function recordConnect(shim, connect, name, args) {
    let [connArgs] = args
    const params = new DatastoreParameters()

    if (shim.isString(connArgs)) {
      connArgs = url.parse(connArgs)
      params.host = connArgs.hostname
      if (connArgs.port) {
        params.port = connArgs.port
      }
    }

    return new OperationSpec({
      name: 'amqplib.connect',
      callback: setCallback(shim, promiseMode),
      promise: promiseMode,
      parameters: params,
      stream: null,
      recorder: null
    })
  })
}
