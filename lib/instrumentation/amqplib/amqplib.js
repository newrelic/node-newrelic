/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const url = require('url')

module.exports.instrumentPromiseAPI = instrumentChannelAPI
module.exports.instrumentCallbackAPI = instrumentCallbackAPI

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

const TEMP_RE = /^amq\./

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
 * Helper to set the appropriate value of the callback property
 * in the spec. If it's a promise set to null otherwise set it to `shim.LAST`
 *
 * @param {Shim} shim instance of shim
 * @param {boolean} promiseMode is this promise based?
 * @returns {string|null} appropriate value
 */
function setCallback(shim, promiseMode) {
  return promiseMode ? null : shim.LAST
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
    let params = null

    if (shim.isString(connArgs)) {
      connArgs = url.parse(connArgs)
      params = { host: connArgs.hostname }
      if (connArgs.port) {
        params.port = connArgs.port
      }
    }

    return {
      name: 'amqplib.connect',
      callback: setCallback(shim, promiseMode),
      promise: promiseMode,
      parameters: params,
      stream: null,
      recorder: null
    }
  })
}

/**
 *
 * Instruments the sendOrEnqueue and sendMessage methods of the ampqlib channel.
 *
 * @param {Shim} shim instance of shim
 */
function wrapChannel(shim) {
  const libChannel = shim.require('./lib/channel')
  if (!libChannel?.Channel?.prototype) {
    shim.logger.debug('Could not get Channel class to instrument.')
    return
  }

  const proto = libChannel.Channel.prototype
  if (shim.isWrapped(proto.sendMessage)) {
    shim.logger.trace('Channel already instrumented.')
    return
  }
  shim.logger.trace('Instrumenting basic Channel class.')

  shim.wrap(proto, 'sendOrEnqueue', function wrapSendOrEnqueue(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }

    return function wrappedSendOrEnqueue() {
      const segment = shim.getSegment()
      const cb = arguments[arguments.length - 1]
      if (!shim.isFunction(cb) || !segment) {
        shim.logger.debug({ cb: !!cb, segment: !!segment }, 'Not binding sendOrEnqueue callback')
        return fn.apply(this, arguments)
      }

      shim.logger.trace('Binding sendOrEnqueue callback to %s', segment.name)
      const args = shim.argsToArray.apply(shim, arguments)
      args[args.length - 1] = shim.bindSegment(cb, segment)
      return fn.apply(this, args)
    }
  })

  shim.recordProduce(proto, 'sendMessage', function recordSendMessage(shim, fn, n, args) {
    const fields = args[0]
    if (!fields) {
      return null
    }
    const isDefault = fields.exchange === ''
    let exchange = 'Default'
    if (!isDefault) {
      exchange = TEMP_RE.test(fields.exchange) ? null : fields.exchange
    }

    return {
      destinationName: exchange,
      destinationType: shim.EXCHANGE,
      routingKey: fields.routingKey,
      headers: fields.headers,
      parameters: getParameters(Object.create(null), fields)
    }
  })
}

/**
 * Sets the relevant message parameters
 *
 * @param {object} parameters object used to store the message parameters
 * @param {object} fields fields from the sendMessage method
 * @returns {object} parameters updated parameters
 */
function getParameters(parameters, fields) {
  if (fields.routingKey) {
    parameters.routing_key = fields.routingKey
  }
  if (fields.correlationId) {
    parameters.correlation_id = fields.correlationId
  }
  if (fields.replyTo) {
    parameters.reply_to = fields.replyTo
  }

  return parameters
}

/**
 *
 * Instruments the relevant channel callback_model or channel_model.
 *
 * @param {Shim} shim instance of shim
 * @param {object} Model either channel or callback model
 * @param {boolean} promiseMode is this promise based?
 */
function wrapModel(shim, Model, promiseMode) {
  if (!Model.Channel?.prototype) {
    shim.logger.debug(
      `Could not get ${promiseMode ? 'promise' : 'callback'} model Channel to instrument.`
    )
  }

  const proto = Model.Channel.prototype
  if (shim.isWrapped(proto.consume)) {
    shim.logger.trace(`${promiseMode ? 'promise' : 'callback'} model already instrumented.`)
    return
  }

  shim.record(proto, CHANNEL_METHODS, function recordChannelMethod(shim, fn, name) {
    return {
      name: 'Channel#' + name,
      callback: setCallback(shim, promiseMode),
      promise: promiseMode
    }
  })

  shim.recordConsume(proto, 'get', {
    destinationName: shim.FIRST,
    callback: setCallback(shim, promiseMode),
    promise: promiseMode,
    messageHandler: function handleConsumedMessage(shim, fn, name, message) {
      // the message is the param when using the promised based model
      message = promiseMode ? message : message[1]
      if (!message) {
        shim.logger.trace('No results from consume.')
        return null
      }
      const parameters = Object.create(null)
      getParameters(parameters, message.fields)
      getParameters(parameters, message.properties)

      const headers = message?.properties?.headers

      return { parameters, headers }
    }
  })

  shim.recordPurgeQueue(proto, 'purgeQueue', function recordPurge(shim, fn, name, args) {
    let queue = args[0]
    if (TEMP_RE.test(queue)) {
      queue = null
    }
    return { queue, promise: promiseMode, callback: setCallback(shim, promiseMode) }
  })

  shim.recordSubscribedConsume(proto, 'consume', {
    name: 'amqplib.Channel#consume',
    queue: shim.FIRST,
    consumer: shim.SECOND,
    promise: promiseMode,
    callback: promiseMode ? null : shim.FOURTH,
    messageHandler: describeMessage
  })
}

/**
 *  Extracts the appropriate messageHandler parameters for the consume method.
 *
 *  @param {Shim} shim instance of shim
 *  @param {object} _consumer not used
 *  @param {string} _name not used
 *  @param {Array} args arguments passed to the consume method
 *  @returns {object} message params
 */
function describeMessage(shim, _consumer, _name, args) {
  const [message] = args

  if (!message?.properties) {
    shim.logger.debug({ message: message }, 'Failed to find message in consume arguments.')
    return null
  }

  const parameters = getParameters(Object.create(null), message.fields)
  getParameters(parameters, message.properties)
  let exchangeName = message?.fields?.exchange || 'Default'

  if (TEMP_RE.test(exchangeName)) {
    exchangeName = null
  }

  return {
    destinationName: exchangeName,
    destinationType: shim.EXCHANGE,
    routingKey: message?.fields?.routingKey,
    headers: message.properties.headers,
    parameters
  }
}
