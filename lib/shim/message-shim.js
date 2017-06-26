'use strict'

var genericRecorder = require('../metrics/recorders/generic')
var messageTransactionRecorder = require('../metrics/recorders/message-transaction')
var logger = require('../logger').child({component: 'MessageShim'})
var TransactionShim = require('./transaction-shim')
var Shim = require('./shim') // For Shim.defineProperty
var util = require('util')


/**
 * Enumeration of well-known message brokers.
 *
 * @readonly
 * @memberof MessageShim
 * @enum {string}
 */
var LIBRARY_NAMES = {
  RABBITMQ: 'RabbitMQ'
}

/**
 * Enumeration of possible message broker destination types.
 *
 * @readonly
 * @memberof MessageShim
 * @enum {string}
 */
var DESTINATION_TYPES = {
  EXCHANGE: 'Exchange',
  QUEUE: 'Queue',
  TOPIC: 'Topic'
}


/**
 * Constructs a shim specialized for instrumenting message brokers.
 *
 * @constructor
 * @extends TransactionShim
 * @classdesc
 *  Used for instrumenting message broker client libraries.
 *
 * @param {Agent} agent
 *  The agent this shim will use.
 *
 * @param {string} moduleName
 *  The name of the module being instrumented.
 *
 * @param {string} resolvedName
 *  The full path to the loaded module.
 *
 * @see Shim
 * @see TransactionShim
 */
function MessageShim(agent, moduleName, resolvedName) {
  TransactionShim.call(this, agent, moduleName, resolvedName)
  this._logger = logger.child({module: moduleName})
  this._metrics = null
}
module.exports = MessageShim
util.inherits(MessageShim, TransactionShim)

// Add constants on the shim for message broker libraries.
MessageShim.LIBRARY_NAMES = LIBRARY_NAMES
Object.keys(LIBRARY_NAMES).forEach(function defineLibraryEnum(libName) {
  Shim.defineProperty(MessageShim, libName, LIBRARY_NAMES[libName])
  Shim.defineProperty(MessageShim.prototype, libName, LIBRARY_NAMES[libName])
})

// Add constants to the shim for message broker destination types.
MessageShim.DESTINATION_TYPES = DESTINATION_TYPES
Object.keys(DESTINATION_TYPES).forEach(function defineTypesEnum(type) {
  Shim.defineProperty(MessageShim, type, DESTINATION_TYPES[type])
  Shim.defineProperty(MessageShim.prototype, type, DESTINATION_TYPES[type])
})

MessageShim.prototype.setLibrary = setLibrary
MessageShim.prototype.recordMessagePublisher = recordMessagePublisher
MessageShim.prototype.recordMessageConsumer = recordMessageConsumer
MessageShim.prototype.recordPurgeQueue = recordPurgeQueue
MessageShim.prototype.recordSubscribeMessageConsumer = recordSubscribeMessageConsumer

// -------------------------------------------------------------------------- //

/**
 * @callback MessageFunction
 *
 * @summary
 *  Used for determining information about a message either being published or
 *  consumed.
 *
 * @param {MessageShim} shim
 *  The shim this function was handed to.
 *
 * @param {Function} func
 *  The publish method or message consumer.
 *
 * @param {string} name
 *  The name of the publisher or consumer.
 *
 * @param {Array.<*>} args
 *  The arguments being passed into the publish method or consumer.
 *
 * @return {MessageSpec} The specification for the message being published or
 *  consumed.
 *
 * @see MessageShim#recordMessagePublisher
 * @see MessageShim#recordMessageConsumer
 */

/**
 * @callback MessageConsumerWrapperFunction
 *
 * @summary
 *  Function that is used to wrap message consumer functions. Used along side
 *  the MessageShim#recordSubscribeMessageConsumer API method.
 *
 * @param {MessageShim} shim
 *  The shim this function was handed to.
 *
 * @param {Function} consumer
 *  The message consumer to wrap.
 *
 * @param {string} name
 *  The name of the consumer method.
 *
 * @param {string} queue
 *  The name of the queue this consumer is being subscribed to.
 *
 * @return {Function} The consumer method, possibly wrapped.
 *
 * @see MessageShim#recordSubscribeMessageConsumer
 * @see MessageShim#recordMessageConsumer
 */

/**
 * @interface MessageSpec
 * @extends RecorderSpec
 *
 * @description
 *  The specification for a message being published or consumed.
 *
 * @property {string} destinationName
 *  The name of the exchange or queue the message is being published to or
 *  consumed from.
 *
 * @property {MessageShim.DESTINATION_TYPES} [destinationType=null]
 *  The type of the destination. Defaults to `shim.EXCHANGE`.
 *
 * @property {Object} [messageProperties=null]
 *  A reference to the message headers. On publish, more headers will be added
 *  to this object which should be sent along with the message. On consume,
 *  cross-application headers will be read from this object.
 *
 * @property {string} [routingKey=null]
 *  The routing key for the message. If provided on consume, the routing key
 *  will be added to the transaction attributes as `message.routingKey`.
 *
 * @property {string} [extras.correlation_id]
 *  In AMQP, this should be the correlation Id of the message, if it has one.
 *
 * @property {string} [extras.reply_to]
 *  In AMQP, this should be the name of the queue to reply to, if the message
 *  has one.
 *
 * @see RecorderSpec
 * @see MessageShim#recordMessagePublisher
 * @see MessageShim#recordMessageConsumer
 * @see MessageShim.DESTINATION_TYPES
 */

/**
 * @interface MessageSubscribeSpec
 * @extends RecorderSpec
 *
 * @description
 *  Specification for message subscriber methods. That is, methods which
 *  register a consumer to start receiving messages.
 *
 * @property {number} queue
 *  Identifies which argument to the subscribe method is the queue the consumer
 *  is being subscribed to.
 *
 * @property {number} consumer
 *  Identifies which argument to the subscribe method is the consumer to be
 *  subscribed.
 *
 * @property {MessageConsumerWrapperFunction} wrapper
 *  A function which should wrap the consumer.
 *
 * @see RecorderSpec
 * @see MessageConsumerWrapperFunction
 * @see MessageShim#recordSubscribeMessageConsumer
 */

// -------------------------------------------------------------------------- //

/**
 * Sets the vendor of the message broker being instrumented.
 *
 * This is used to generate the names for metrics and segments. If a string is
 * passed, metric names will be generated using that.
 *
 * @memberof MessageShim.prototype
 *
 * @param {MessageShim.LIBRARY_NAMES|string} library
 *  The name of the message broker library. Use one of the well-known constants
 *  listed in {@link MessageShim.LIBRARY_NAMES} if available for the library.
 *
 * @see MessageShim.LIBRARY_NAMES
 */
function setLibrary(library) {
  this._metrics = {
    PREFIX: 'MessageBroker/',
    LIBRARY: library,
    PRODUCE: 'Produce/',
    CONSUME: 'Consume/',
    PURGE: 'Purge/',
    NAMED: 'Named/',
    TEMP: 'Temp'
  }

  this._logger = this._logger.child({library: library})
  this.logger.trace({metrics: this._metrics}, 'Library metric names set')
}

/**
 * Wraps the given properties as message publishing methods to be recorded.
 *
 * - `recordMessagePublisher(nodule, properties, recordNamer)`
 * - `recordMessagePublisher(func, recordNamer)`
 *
 * The resulting wrapped methods will record their executions using the messaging
 * `PRODUCE` metric.
 *
 * @memberof MessageShim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {MessageFunction} recordNamer
 *  A function which specifies details of the message.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
 * @see Shim#wrap
 * @see Shim#record
 * @see MessageSpec
 * @see MessageFunction
 */
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

    var name = _nameMessageSegment(shim, msgDesc, shim._metrics.PRODUCE)
    if (msgDesc.messageProperties) {
      shim.insertCATRequestHeaders(msgDesc.messageProperties, true)
    }

    if (!shim.agent.config.message_tracer.segment_parameters.enabled) {
      delete msgDesc.extras
    } else if (msgDesc.routingKey) {
      msgDesc.extras = shim.setDefaults(msgDesc.extras, {
        routing_key: msgDesc.routingKey
      })
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

/**
 * Wraps the given properties as message consumers to be recorded.
 *
 * - `recordMessageConsumer(nodule, properties, recordNamer)`
 * - `recordMessageConsumer(func, recordNamer)`
 *
 * The resulting wrapped methods will record their executions using the messaging
 * `CONSUME` metric, possibly also starting a message transaction. Note that
 * this should wrap the message _consumer_, to record methods which subscribe
 * consumers see {@link MessageShim#recordSubscribeMessageConsumer}
 *
 * @memberof MessageShim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {MessageFunction} recordNamer
 *  A function which specifies details of the message.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
 * @see Shim#wrap
 * @see Shim#record
 * @see MessageShim#recordSubscribeMessageConsumer
 * @see MessageSpec
 * @see MessageFunction
 */
function recordMessageConsumer(nodule, properties, recordNamer) {
  if (this.isFunction(properties)) {
    // recordMessageConsumer(func, recordNamer)
    recordNamer = properties
    properties = null
  }

  return this.wrap(nodule, properties, function wrapConsumer(shim, consumer, fnName) {
    if (!shim.isFunction(consumer)) {
      return consumer
    }

    // This recorder is used in the case where we're already in a transaction
    // when the consumer is called. It just creates a segment for consumption
    // and check for CAT headers.
    function recorder() {
      var args = shim.argsToArray.apply(shim, arguments)
      var msgDesc = recordNamer.call(this, shim, consumer, fnName, args)
      var segment = _makeConsumeSegment(shim, msgDesc, false) // false === no CAT
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
      var msgDesc = recordNamer.call(this, shim, consumer, fnName, args)
      var segment = _makeConsumeSegment(shim, msgDesc, true) // true === yes CAT
      if (!segment) {
        shim.logger.debug('Failed to create base segment for tx %s', tx.id)
        tx.end()
        return consumer.apply(this, args)
      }

      // If we have a routing key, add it to the transaction. Note that it is
      // camel cased here, but snake cased in the segment parameters.
      if (msgDesc.routingKey && !shim.agent.config.high_security) {
        tx.trace.addParameter('message.routingKey', msgDesc.routingKey)
      }

      // Set up the transaction as a message transaction.
      var txName = tx.getName()
      if (!txName) {
        txName = segment.name.replace(/(?:^MessageBroker|Consume)\//g, '')
        tx.setPartialName(txName)
      }
      tx.baseSegment = segment
      tx.addRecorder(
        messageTransactionRecorder.bind(null, tx.baseSegment, txName, tx.getFullName())
      )
      shim.logger.trace('Started message transaction %s named %s', tx.id, txName)

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

/**
 * Wraps the given properties as queue purging methods.
 *
 * - `recordPurgeQueue(nodule, properties, spec)`
 * - `recordPurgeQueue(func, spec)`
 *
 * @memberof MessageShim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {RecorderSpec} spec
 *  The specification for this queue purge method's interface.
 *
 * @param {string} spec.queue
 *  The name of the queue being purged.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
 * @see Shim#wrap
 * @see Shim#record
 * @see RecorderSpec
 */
function recordPurgeQueue(nodule, properties, spec) {
  if (!nodule) {
    this.logger.debug('Not wrapping non-existent nodule.')
    return nodule
  }

  // Sort out the parameters.
  if (!this.isString(properties) && !this.isArray(properties)) {
    // recordPurgeQueue(nodule, spec)
    spec = properties
    properties = null
  }

  // Fill the spec with defaults.
  var specIsFunction = this.isFunction(spec)
  if (!specIsFunction) {
    spec = this.setDefaults(spec, {
      queue: null,
      callback: null,
      promise: false,
      internal: false
    })
  }

  return this.record(nodule, properties, function purgeRecorder(shim, fn, name, args) {
    var descriptor = spec
    if (specIsFunction) {
      descriptor = spec.apply(this, arguments)
    }

    var queue = descriptor.queue
    if (shim.isNumber(queue)) {
      var queueIdx = shim.normalizeIndex(args.length, descriptor.queue)
      queue = args[queueIdx]
    }

    return {
      name: _nameMessageSegment(shim, {
        destinationType: shim.QUEUE,
        destinationName: queue
      }, shim._metrics.PURGE),
      recorder: genericRecorder,
      callback: descriptor.callback,
      promise: descriptor.promise,
      internal: descriptor.internal
    }
  })
}

/**
 * Wraps the given properties as message subscription methods.
 *
 * - `recordSubscribeMessageConsumer(nodule, properties, spec)`
 * - `recordSubscribeMessageConsumer(func, spec)`
 *
 * Message subscriber methods are ones used to register a message consumer with
 * the message library. See {@link MessageShim#recordMessageConsumer} for
 * recording the consumer itself.
 *
 * Note that unlike most `shim.recordX` methods, this method will call the
 * `spec.wrapper` method even if no transaction is active.
 *
 * @memberof MessageShim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {MessageSubscribeSpec} spec
 *  The specification for this subscription method's interface.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
 * @see Shim#wrap
 * @see Shim#record
 * @see MessageShim#recordMessageConsumer
 * @see MessageSubscribeSpec
 */
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
  var wrapped = this.wrap(nodule, properties, function wrapSubscriber(shim, fn) {
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
          consumer,
          shim.getName(consumer),
          queueName
        )))
      }

      return fn.apply(this, args)
    }
  })

  // Now that we're guaranteed to wrap the consumer, wrap the subscriber with
  // segment creation.
  return this.record(wrapped, properties, function recordSubber(shim, fn, name, args) {
    // Make sure the specified consumer and callback indexes do not overlap.
    // This could happen for instance if the function signature is
    // `fn(consumer [, callback])` and specified as `consumer: shim.FIRST`,
    // `callback: shim.LAST`.
    var consumerIdx = shim.normalizeIndex(args.length, spec.consumer)
    var cbIdx = shim.normalizeIndex(args.length, spec.callback)
    if (cbIdx === consumerIdx) {
      cbIdx = null
    }

    return {
      name: spec.name || name,
      callback: cbIdx,
      promise: spec.promise,

      stream: false,
      internal: false
    }
  })
}

// -------------------------------------------------------------------------- //

/**
 * Constructs a message segment name from the given message descriptor.
 *
 * @private
 *
 * @param {MessageShim} shim    - The shim the segment will be constructed by.
 * @param {MessageSpec} msgDesc - The message descriptor.
 * @param {string}      action  - Publish or consume?
 *
 * @return {string} The generated name of the message segment.
 */
function _nameMessageSegment(shim, msgDesc, action) {
  var name =
    shim._metrics.PREFIX + shim._metrics.LIBRARY + '/' +
    (msgDesc.destinationType || shim.EXCHANGE) + '/' + action

  if (msgDesc.destinationName) {
    name += shim._metrics.NAMED + msgDesc.destinationName
  } else {
    name += shim._metrics.TEMP
  }

  return name
}

/**
 * Constructs a message segment for a consume and extracts CAT headers if available.
 *
 * @private
 *
 * @param {MessageShim} shim      - The shim the segment will be constructed by.
 * @param {MessageSpec} msgDesc   - The message descriptor.
 * @param {bool}        checkCAT  - Flag indicating if CAT headers should be used.
 *
 * @return {TraceSegment} The constructed trace segment.
 */
function _makeConsumeSegment(shim, msgDesc, checkCAT) {
  // Process the message args.
  if (!msgDesc) {
    return null
  }

  var name = _nameMessageSegment(shim, msgDesc, shim._metrics.CONSUME)
  var segDesc = {
    name: name,
    promise: msgDesc.promise || false,
    callback: msgDesc.callback || null,
    recorder: genericRecorder,
    extras: msgDesc.extras || {}
  }

  if (msgDesc.routingKey && !segDesc.extras.routing_key) {
    segDesc.extras.routing_key = msgDesc.routingKey
  }

  if (!shim.agent.config.message_tracer.segment_parameters.enabled) {
    delete segDesc.extras
  }

  // Create the segment and attach any CAT data.
  var segment = shim.createSegment(segDesc)
  if (checkCAT && msgDesc.messageProperties) {
    shim.handleCATHeaders(msgDesc.messageProperties, segment)
  }

  return segment
}
