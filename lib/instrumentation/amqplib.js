'use strict'

// TODO: Make this an external module.
// var newrelic = require('newrelic')
// newrelic.instrumentMessages('amqplib', instrumentChannelAPI)
// newrelic.instrumentMessages('amqplib/channel_api', instrumentChannelAPI)
// newrelic.instrumentMessages('amqplib/channel_api.js', instrumentChannelAPI)
// newrelic.instrumentMessages('amqplib/callback_api', instrumentCallbackAPI)
// newrelic.instrumentMessages('amqplib/callback_api.js', instrumentCallbackAPI)
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
  'get',
  'prefetch',
  'recover'
]


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
    return {
      name: 'amqplib.connect',
      callback: promiseMode ? null : shim.LAST,
      promise: promiseMode,
      extras: {url: args[0]}, // TODO: Parse the URL to get the hostname out

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

  shim.recordMessagePublisher(proto, 'sendMessage', recordSendMessage)
  function recordSendMessage(shim, fn, n, args) {
    var fields = args[0]
    if (!fields) {
      return null
    }
    var isDefault = fields.exchange === ''

    return {
      destinationName: isDefault ? 'Default' : fields.exchange,
      destinationType: isDefault ? shim.QUEUE : shim.EXCHANGE,
      routingKey: fields.routingKey,
      messageProperties: fields.headers,
      extras: getExtras({}, fields)
    }
  }
}

function getExtras(extras, fields) {
  if (fields.correlationId) {
    extras.correlation_id = fields.correlationId
  }
  if (fields.replyTo) {
    extras.reply_to = fields.replyTo
  }

  return extras
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

  shim.recordPurgeQueue(proto, 'purgeQueue', {queue: shim.FIRST, promise: true})

  shim.recordSubscribeMessageConsumer(proto, 'consume', {
    name: 'amqplib.Channel#consume',
    queue: shim.FIRST,
    consumer: shim.SECOND,
    promise: true,
    wrapper: function wrapConsumer(shim, consumer, name, queue) {
      return shim.recordMessageConsumer(consumer, makeRecordConsumer(queue))
    }
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

  shim.recordPurgeQueue(proto, 'purgeQueue', {queue: shim.FIRST, callback: shim.LAST})

  shim.recordSubscribeMessageConsumer(proto, 'consume', {
    name: 'amqplib.Channel#consume',
    queue: shim.FIRST,
    consumer: shim.SECOND,
    callback: shim.FOURTH,
    promise: false,
    wrapper: function wrapConsumer(shim, consumer, name, queue) {
      return shim.recordMessageConsumer(consumer, makeRecordConsumer(queue))
    }
  })
}

function makeRecordConsumer(queue) {
  return function recordConsumer(shim, fn, name, args) {
    var message = args[0]
    if (!message || !message.properties) {
      shim.logger.debug(
        {message: message},
        'Failed to find message in consume arguments.'
      )
      return null
    }

    var exchangeName = message.fields.exchange
    var extras = getExtras({queue_name: queue}, message.fields)
    getExtras(extras, message.properties)

    return {
      destinationName: exchangeName || 'Default',
      destinationType: exchangeName ? shim.EXCHANGE : shim.QUEUE,
      routingKey: message.fields.routingKey,
      messageProperties: message.properties.headers,
      extras: extras
    }
  }
}
