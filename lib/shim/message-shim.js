'use strict'

var genericRecorder = require('../metrics/recorders/generic')
var logger = require('../logger').child({component: 'MessageShim'})
var TransactionShim = require('./transaction-shim')
var Shim = require('./shim') // For Shim.defineProperty
var util = require('util')


var LIBRARY_NAMES = {
  RABBITMQ: 'RabbitMQ'
}

function MessageShim(agent, moduleName, resolvedName) {
  TransactionShim.call(this, agent, moduleName, resolvedName)
  this._logger = logger.child({module: moduleName})
  this._metrics = null
}
module.exports = MessageShim
util.inherits(MessageShim, TransactionShim)

MessageShim.LIBRARY_NAMES = LIBRARY_NAMES
Object.keys(LIBRARY_NAMES).forEach(function defineLibraryEnum(libName) {
  Shim.defineProperty(MessageShim, libName, LIBRARY_NAMES[libName])
  Shim.defineProperty(MessageShim.prototype, libName, LIBRARY_NAMES[libName])
})

MessageShim.prototype.setLibrary = setLibrary
MessageShim.prototype.recordMessagePublisher = recordMessagePublisher
MessageShim.prototype.recordMessageConsumer = recordMessageConsumer
MessageShim.prototype.recordSubscribeMessageConsumer = recordSubscribeMessageConsumer

// -------------------------------------------------------------------------- //

function setLibrary(library) {
  this._metrics = {
    PREFIX: 'MessageBroker/',
    LIBRARY: library,
    PRODUCE: 'Produce/',
    CONSUME: 'Consume/',
    NAMED: 'Named/',
    ROUTED: 'Routed/'
  }

  this._logger = this._logger.child({library: library})
  this.logger.trace({metrics: this._metrics}, 'Library metric names set')
}

function recordMessagePublisher(nodule, properties, recordNamer) {
  if (this.isFunction(properties)) {
    // recordMessagePublisher(func, recordNamer)
    recordNamer = properties
    properties = null
  }

  return this.record(nodule, properties, function recordPublisher(shim) {
    var msgDesc = recordNamer.apply(this, arguments)
    if (!msgDesc) {
      return null
    }

    var name = _nameMessageSegment(shim, msgDesc, this._metrics.PRODUCE)
    if (msgDesc.headers) {
      shim.insertCATHeaders(msgDesc.headers, true) // true === message queue
      if (msgDesc.extras && shim.isReplyMessage(msgDesc.extras)) {
        shim.insertCATReplyHeader(msgDesc.headers, true)
      }
    }

    return {
      name: name,
      promise: msgDesc.promise || false,
      callback: msgDesc.callback || null,
      recorder: genericRecorder,
      extras: msgDesc.extras || null
    }
  })
}

function recordMessageConsumer(nodule, properties, recordNamer) {
  if (this.isFunction(properties)) {
    // recordMessageConsumer(func, recordNamer)
    recordNamer = properties
    properties = null
  }

  return this.wrap(nodule, properties, function wrapConsumer(shim, consumer) {
    if (!shim.isFunction(consumer)) {
      return consumer
    }

    // This recorder is used in the case where we're already in a transaction
    // when the consumer is called. It just creates a segment for consumption
    // and check for CAT headers.
    function recorder() {
      var args = shim.argsToArray.apply(shim, arguments)
      var segment = _makeConsumeSegment(shim, recordNamer, this, args)
      return shim.applySegment(consumer, segment, true, this, args)
    }

    // The transactor is used when we are not in a transaction when the consumer
    // is called. It creates a new transaction and processes any incoming CAT
    // headers.
    var transactor = shim.bindCreateTransaction(function wrappedConsumer() {
      var tx = shim.tracer.getTransaction()
      if (!tx) {
        shim.logger.debug('Failed to start message transaction.')
        return consumer.apply(this, arguments)
      }

      // A new transaction has started, get it and process the message.
      var args = shim.argsToArray.apply(shim, arguments)
      var segment = _makeConsumeSegment(shim, recordNamer, this, args)
      if (!segment) {
        shim.logger.debug('Failed to create base segment for tx %s', tx.id)
        tx.end()
        return consumer.apply(this, args)
      }

      var txName = segment.name.replace(/^MessageBroker\//, '')
      tx.setPartialName(txName)
      tx.baseSegment = segment
      shim.logger.trace('Started message transaction %s named %s', tx.id, tx.name)

      // Execute the original function and attempt to hook in the transaction
      // finish.
      var ret = null
      try {
        ret = shim.applySegment(consumer, segment, true, this, args)
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

      function endTransaction() {
        tx.finalizeName(null) // Use existing partial name.
        tx.end()
      }
    }, {
      type: shim.MESSAGE,
      nest: false
    })

    return function wrappedConsumer() {
      // If we are in a transaction, just add a segment.
      if (shim.getSegment()) {
        return recorder.apply(this, arguments)
      }
      return transactor.apply(this, arguments)
    }
  })
}

function recordSubscribeMessageConsumer(nodule, properties, spec) {
  if (!nodule) {
    this.logger.debug('Not wrapping non-existent nodule.')
    return nodule
  }

  // Sort out the parameters.
  if (this.isObject(properties) && !this.isArray(properties)) {
    // recordSubscribeMessageConsumer(nodule, spec)
    spec = properties
    properties = null
  }

  // Fill the spec with defaults.
  spec = this.setDefaults(spec, {
    name: null,
    queue: null,
    consumer: null,
    callback: null,
    wrapper: null,
    promise: false
  })

  // Make sure our spec has what we need.
  if (!this.isFunction(spec.wrapper)) {
    this.logger.debug('spec.wrapper should be a function')
    return nodule
  } else if (!this.isNumber(spec.consumer)) {
    this.logger.debug('spec.consumer is required for recordSubscribeMessageConsumer')
    return nodule
  }

  // We need to wrap the subscriber with our own method that extracts the
  // consumer and wraps that first. This is because we want to wrap the consumer
  // regardless of if we're in a transaction and `shim.record` only calls the
  // record namer function if it will generate a segment.
  var wrapped = this.wrap(nodule, properties, function wrapSubscriber(shim, fn, fnName) {
    if (!shim.isFunction(fn)) {
      return fn
    }

    return function wrappedSubscriber() {
      var args = shim.argsToArray.apply(shim, arguments)
      var queueIdx = shim.normalizeIndex(args.length, spec.queue)
      var queueName = queueIdx !== null ? args[queueIdx] : null

      var consumerIdx = shim.normalizeIndex(args.length, spec.consumer)
      if (consumerIdx !== null && shim.isFunction(args[consumerIdx])) {
        var consumer = args[consumerIdx]
        args[consumerIdx] = shim.bindSegment(shim.fixArity(consumer, spec.wrapper.call(
          this,
          shim,
          fn,
          fnName,
          consumer,
          queueName
        )))
      }

      return fn.apply(this, args)
    }
  })

  // Now that we're guaranteed to wrap the consumer, wrap the subscriber with
  // segment creation.
  return this.record(wrapped, properties, function recordSubscriber(shim, fn, name) {
    return {
      name: spec.name || name,
      callback: spec.callback,
      promise: spec.promise,

      stream: false,
      internal: false
    }
  })
}

function _nameMessageSegment(shim, msgDesc, action) {
  var name =
    shim._metrics.PREFIX + shim._metrics.LIBRARY + '/' +
    (msgDesc.type || shim.EXCHANGE) + '/' +
    action + shim._metrics.NAMED + (msgDesc.name || '<unknown>')
  if (msgDesc.routingKey) {
    name += '/' + shim._metrics.ROUTED + msgDesc.routingKey
  }
  return name
}

function _processConsumeMessageDescriptor(shim, msgDesc) {
  if (!msgDesc) {
    return null
  }

  var name = _nameMessageSegment(shim, msgDesc, this._metrics.CONSUME)
  if (msgDesc.headers) {
    shim.handleCATHeaders(msgDesc.headers)
  }

  return {
    name: name,
    promise: msgDesc.promise || false,
    callback: msgDesc.callback || null,
    recorder: genericRecorder,
    extras: msgDesc.extras || null
  }
}

function _makeConsumeSegment(shim, recordNamer, ctx, args) {
  // Process the message args.
  var msgDesc = recordNamer.apply(ctx, args)
  var segDesc = _processConsumeMessageDescriptor(shim, msgDesc)
  if (!msgDesc) {
    return null
  }

  // Create the segment and attach any CAT data.
  var segment = shim.createSegment(segDesc)
  if (msgDesc.headers) {
    shim.handleCATHeaders(msgDesc.headers, segment)
  }

  return segment
}
