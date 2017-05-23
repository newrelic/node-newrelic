'use strict'

// TODO: Make this an external module.

var newrelic = require('newrelic')

newrelic.instrumentMessages('amqplib', instrumentChannelAPI)
newrelic.instrumentMessages('amqplib/channel_api', instrumentChannelAPI)
newrelic.instrumentMessages('amqplib/channel_api.js', instrumentChannelAPI)
function instrumentChannelAPI(shim, amqp) {
  instrumentAMQP(shim, amqp, true)
  // TODO: wrapPromiseChannel(shim)
}

newrelic.instrumentMessages('amqplib/callback_api', instrumentCallbackAPI)
newrelic.instrumentMessages('amqplib/callback_api.js', instrumentCallbackAPI)
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
    return
  }

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
      name: isDefault ? 'Default' : fields.exchange,
      routingKey: fields.routingKey,
      type: isDefault ? shim.QUEUE : shim.EXCHANGE,
      headers: fields.headers,
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
    if (!message || !message.properties || !message.properties.headers) {
      shim.logger.debug(
        {message: message},
        'Failed to find message in consume arguments.'
      )
      return null
    }

    var exchangeName = message.fields.exchange
    var extras = getExtras({queuename: queue}, message.fields)
    getExtras(extras, message.properties)

    return {
      name: exchangeName || 'Default',
      routingKey: message.fields.routingKey,
      type: exchangeName ? shim.EXCHANGE : shim.QUEUE,
      headers: message.properties.headers,
      extras: extras
    }
  }
}
