'use strict'

var url = require('url')


// TODO: Make this an external module.
// var newrelic = require('newrelic')
// newrelic.instrumentMessages('amqplib', instrumentChannelAPI)
// newrelic.instrumentMessages('amqplib/channel_api', instrumentChannelAPI)
// newrelic.instrumentMessages('amqplib/channel_api.js', instrumentChannelAPI)
// newrelic.instrumentMessages('amqplib/callback_api', instrumentCallbackAPI)
// newrelic.instrumentMessages('amqplib/callback_api.js', instrumentCallbackAPI)
module.exports.selfRegister = function selfRegister(shimmer) {
  shimmer.registerInstrumentation({
    moduleName: 'amqplib',
    type: 'message',
    onRequire: instrumentChannelAPI
  })
  shimmer.registerInstrumentation({
    moduleName: 'amqplib/channel_api',
    type: 'message',
    onRequire: instrumentChannelAPI
  })
  shimmer.registerInstrumentation({
    moduleName: 'amqplib/channel_api.js',
    type: 'message',
    onRequire: instrumentChannelAPI
  })
  shimmer.registerInstrumentation({
    moduleName: 'amqplib/callback_api',
    type: 'message',
    onRequire: instrumentCallbackAPI
  })
  shimmer.registerInstrumentation({
    moduleName: 'amqplib/callback_api.js',
    type: 'message',
    onRequire: instrumentCallbackAPI
  })
}

module.exports.instrumentPromiseAPI = instrumentChannelAPI
module.exports.instrumentCallbackAPI = instrumentCallbackAPI

var CHANNEL_METHODS = [
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

var TEMP_RE = /^amq\./


function instrumentChannelAPI(shim, amqp) {
  instrumentAMQP(shim, amqp, true)
  wrapPromiseChannel(shim)
}

function instrumentCallbackAPI(shim, amqp) {
  instrumentAMQP(shim, amqp, false)
  wrapCallbackChannel(shim)
}

function instrumentAMQP(shim, amqp, promiseMode) {
  if (!amqp || !amqp.connect) {
    shim.logger.debug('This module is not the amqplib we\'re looking for.')
    return false
  }

  if (shim.isWrapped(amqp.connect)) {
    shim.logger.trace('This module has already been instrumented, skipping.')
    return
  }
  shim.setLibrary(shim.RABBITMQ)

  shim.record(amqp, 'connect', function recordConnect(shim, connect, name, args) {
    var connArgs = args[0]
    var params = null

    if (shim.isString(connArgs)) {
      connArgs = url.parse(connArgs)
      params = {host: connArgs.hostname}
      if (connArgs.port) {
        params.port = connArgs.port
      }
    }

    return {
      name: 'amqplib.connect',
      callback: promiseMode ? null : shim.LAST,
      promise: promiseMode,
      parameters: params,

      stream: null,
      recorder: null
    }
  })

  wrapChannel(shim)
}

function wrapChannel(shim) {
  var libChannel = shim.require('./lib/channel')
  if (!libChannel || !libChannel.Channel || !libChannel.Channel.prototype) {
    shim.logger.debug('Could not get Channel class to instrument.')
    return
  }

  var proto = libChannel.Channel.prototype
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
      var segment = shim.getSegment()
      var cb = arguments[arguments.length - 1]
      if (!shim.isFunction(cb) || !segment) {
        shim.logger.debug(
          {cb: !!cb, segment: !!segment},
          'Not binding sendOrEnqueue callback'
        )
        return fn.apply(this, arguments)
      }

      shim.logger.trace('Binding sendOrEnqueue callback to %s', segment.name)
      var args = shim.argsToArray.apply(shim, arguments)
      args[args.length - 1] = shim.bindSegment(cb, segment)
      return fn.apply(this, args)
    }
  })

  // Example fields:
  // { exchange: 'test-exchange-topic',
  //   routingKey: 'routing.key',
  //   mandatory: false,
  //   immediate: false,
  //   ticket: undefined,
  //   contentType: undefined,
  //   contentEncoding: undefined,
  //   headers: {},
  //   deliveryMode: undefined,
  //   priority: undefined,
  //   correlationId: undefined,
  //   replyTo: undefined,
  //   expiration: undefined,
  //   messageId: undefined,
  //   timestamp: undefined,
  //   type: undefined,
  //   userId: undefined,
  //   appId: undefined,
  //   clusterId: undefined }

  shim.recordProduce(proto, 'sendMessage', recordSendMessage)
  function recordSendMessage(shim, fn, n, args) {
    var fields = args[0]
    if (!fields) {
      return null
    }
    var isDefault = fields.exchange === ''
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
  }
}

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

function wrapPromiseChannel(shim) {
  var libPModel = shim.require('./lib/channel_model')
  if (!libPModel || !libPModel.Channel || !libPModel.Channel.prototype) {
    shim.logger.debug('Could not get promise model Channel to instrument')
  }

  var proto = libPModel.Channel.prototype
  if (shim.isWrapped(proto.consume)) {
    shim.logger.trace('Promise model already isntrumented.')
    return
  }

  shim.record(proto, CHANNEL_METHODS, function recordChannelMethod(shim, fn, name) {
    return {
      name: 'Channel#' + name,
      promise: true
    }
  })

  shim.recordConsume(proto, 'get', {
    destinationName: shim.FIRST,
    promise: true,
    messageHandler: function handleConsumedMessage(shim, fn, name, message) {
      if (!message) {
        shim.logger.trace('No results from consume.')
        return null
      }
      var parameters = Object.create(null)
      getParameters(parameters, message.fields)
      getParameters(parameters, message.properties)

      var headers = null
      if (message.properties && message.properties.headers) {
        headers = message.properties.headers
      }

      return {parameters: parameters, headers: headers}
    }
  })

  shim.recordPurgeQueue(proto, 'purgeQueue', function recordPurge(shim, fn, name, args) {
    var queue = args[0] || null
    if (TEMP_RE.test(queue)) {
      queue = null
    }

    return {queue: queue, promise: true}
  })

  shim.recordSubscribedConsume(proto, 'consume', {
    name: 'amqplib.Channel#consume',
    queue: shim.FIRST,
    consumer: shim.SECOND,
    promise: true,
    messageHandler: describeMessage
  })
}

function wrapCallbackChannel(shim) {
  var libCbModel = shim.require('./lib/callback_model')
  if (!libCbModel || !libCbModel.Channel || !libCbModel.Channel.prototype) {
    shim.logger.debug('Could not get callback model Channel to instrument')
    return
  }

  var proto = libCbModel.Channel.prototype
  if (shim.isWrapped(proto.consume)) {
    return
  }

  // Example message:
  // { fields:
  //  { consumerTag: 'amq.ctag-8oZE10ovvyAP8e-vgbOnSA',
  //    deliveryTag: 1,
  //    redelivered: false,
  //    exchange: 'test-exchange-topic',
  //    routingKey: 'routing.key' },
  // properties:
  //  { contentType: undefined,
  //    contentEncoding: undefined,
  //    headers: {},
  //    deliveryMode: undefined,
  //    priority: undefined,
  //    correlationId: undefined,
  //    replyTo: undefined,
  //    expiration: undefined,
  //    messageId: undefined,
  //    timestamp: undefined,
  //    type: undefined,
  //    userId: undefined,
  //    appId: undefined,
  //    clusterId: undefined },
  // content: Buffer [ 97 ] }

  shim.record(proto, CHANNEL_METHODS, function recordChannelMethod(shim, fn, name) {
    return {
      name: 'Channel#' + name,
      callback: shim.LAST
    }
  })

  shim.recordConsume(proto, 'get', {
    destinationName: shim.FIRST,
    callback: shim.LAST,
    messageHandler: function handleConsumedMessage(shim, fn, name, args) {
      var message = args[1]
      if (!message) {
        shim.logger.trace('No results from consume.')
        return null
      }
      var parameters = Object.create(null)
      getParameters(parameters, message.fields)
      getParameters(parameters, message.properties)

      var headers = null
      if (message.properties && message.properties.headers) {
        headers = message.properties.headers
      }

      return {parameters: parameters, headers: headers}
    }
  })

  shim.recordPurgeQueue(proto, 'purgeQueue', function recordPurge(shim, fn, name, args) {
    var queue = args[0]
    if (TEMP_RE.test(queue)) {
      queue = null
    }

    return {queue: queue, callback: shim.LAST}
  })


  shim.recordSubscribedConsume(proto, 'consume', {
    name: 'amqplib.Channel#consume',
    queue: shim.FIRST,
    consumer: shim.SECOND,
    callback: shim.FOURTH,
    promise: false,
    messageHandler: describeMessage
  })
}

function describeMessage(shim, consumer, name, args) {
  var message = args[0]
  if (!message || !message.properties) {
    shim.logger.debug(
      {message: message},
      'Failed to find message in consume arguments.'
    )
    return null
  }

  var exchangeName = message.fields.exchange
  var parameters = getParameters(Object.create(null), message.fields)
  getParameters(parameters, message.properties)

  if (!exchangeName) {
    exchangeName = 'Default'
  } else if (TEMP_RE.test(exchangeName)) {
    exchangeName = null
  }

  return {
    destinationName: exchangeName,
    destinationType: shim.EXCHANGE,
    routingKey: message.fields.routingKey,
    headers: message.properties.headers,
    parameters: parameters
  }
}
