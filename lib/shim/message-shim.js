'use strict'

var genericRecorder = require('../metrics/recorders/generic')
// var messageTransactionRecorder = require('../metrics/recorders/message-transaction')
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
MessageShim.prototype.recordProduce = recordProduce
MessageShim.prototype.recordConsume = recordConsume
MessageShim.prototype.recordPurgeQueue = recordPurgeQueue
MessageShim.prototype.recordSubcribeConsumer = recordSubcribeConsumer

// -------------------------------------------------------------------------- //

/**
 * @callback MessageFunction
 *
 * @summary
 *  Used for determining information about a message either being produced or
 *  consumed.
 *
 * @param {MessageShim} shim
 *  The shim this function was handed to.
 *
 * @param {Function} func
 *  The produce method or message consumer.
 *
 * @param {string} name
 *  The name of the producer or consumer.
 *
 * @param {Array.<*>} args
 *  The arguments being passed into the produce method or consumer.
 *
 * @return {MessageSpec} The specification for the message being produced or
 *  consumed.
 *
 * @see MessageShim#recordProduce
 * @see MessageShim#recordConsume
 */

/**
 * @callback MessageHandlerFunction
 *
 * @summary
 *  A function that is used to extract properties from a consumed message. This
 *  method is handed the results of a consume call. If the consume used a
 *  callback, then this method will receive the arguments to the callback. If
 *  the consume used a promise, then this method will receive the resolved
 *  value.
 *
 * @param {MessageShim} shim
 *  The shim this function was handed to.
 *
 * @param {Function} func
 *  The produce method or message consumer.
 *
 * @param {string} name
 *  The name of the producer or consumer.
 *
 * @param {Array|*} args
 *  Either the arguments for the consumer callback function or the result of
 *  the resolved consume promise, depending on the mode of the instrumented
 *  method.
 *
 * @see MessageShim#recordConsume
 */

/**
 * @callback MessageConsumerWrapperFunction
 *
 * @summary
 *  Function that is used to wrap message consumer functions. Used along side
 *  the MessageShim#recordSubcribeConsumer API method.
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
 * @see MessageShim#recordSubcribeConsumer
 * @see MessageShim#recordConsume
 */

/**
 * @interface MessageSpec
 * @extends RecorderSpec
 *
 * @description
 *  The specification for a message being produced or consumed.
 *
 * @property {string} destinationName
 *  The name of the exchange or queue the message is being produced to or
 *  consumed from.
 *
 * @property {MessageShim.DESTINATION_TYPES} [destinationType=null]
 *  The type of the destination. Defaults to `shim.EXCHANGE`.
 *
 * @property {Object} [messageProperties=null]
 *  A reference to the message headers. On produce, more headers will be added
 *  to this object which should be sent along with the message. On consume,
 *  cross-application headers will be read from this object.
 *
 * @property {string} [routingKey=null]
 *  The routing key for the message. If provided on consume, the routing key
 *  will be added to the transaction attributes as `message.routingKey`.
 *
 * @property {string} [parameters.correlation_id]
 *  In AMQP, this should be the correlation Id of the message, if it has one.
 *
 * @property {string} [parameters.reply_to]
 *  In AMQP, this should be the name of the queue to reply to, if the message
 *  has one.
 *
 * @property {MessageHandlerFunction} [resultHandler]
 *  An optional function to extract message properties from a consumed message.
 *  This method is only used in the consume case to pull data from the
 *  retrieved message.
 *
 * @see RecorderSpec
 * @see MessageShim#recordProduce
 * @see MessageShim#recordConsume
 * @see MessageShim.DESTINATION_TYPES
 */

/**
 * @interface MessageProperties
 *
 * @description
 *  Extra parameters and headers from a message.
 *
 * @property {object} parameters
 *  Extra properties to copy onto the message segment, pulled from the message
 *  itself. This could include reply to, correlation id, and routing key.
 *
 * @property {object} headers
 *  The message headers which can be used to pull cross-application tracing
 *  information.
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
 * @see MessageShim#recordSubcribeConsumer
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
 * Wraps the given properties as message producing methods to be recorded.
 *
 * - `recordProduce(nodule, properties, recordNamer)`
 * - `recordProduce(func, recordNamer)`
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
function recordProduce(nodule, properties, recordNamer) {
  if (this.isFunction(properties)) {
    // recordProduce(func, recordNamer)
    recordNamer = properties
    properties = null
  }

  return this.record(nodule, properties, function recordProd(shim) {
    var msgDesc = recordNamer.apply(this, arguments)
    if (!msgDesc) {
      return null
    }

    var name = _nameMessageSegment(shim, msgDesc, shim._metrics.PRODUCE)
    if (msgDesc.messageProperties) {
      shim.insertCATRequestHeaders(msgDesc.messageProperties, true)
    }

    if (!shim.agent.config.message_tracer.segment_parameters.enabled) {
      delete msgDesc.parameters
    } else if (msgDesc.routingKey) {
      msgDesc.parameters = shim.setDefaults(msgDesc.parameters, {
        routing_key: msgDesc.routingKey
      })
    }

    return {
      name: name,
      promise: msgDesc.promise || false,
      callback: msgDesc.callback || null,
      recorder: genericRecorder,
      parameters: msgDesc.parameters || null
    }
  })
}

/**
 * Wraps the given properties as message consumers to be recorded.
 *
 * - `recordConsume(nodule, properties, spec)`
 * - `recordConsume(func, spec)`
 *
 * The resulting wrapped methods will record their executions using the messaging
 * `CONSUME` metric, possibly also starting a message transaction. Note that
 * this should wrap the message _consumer_, to record methods which subscribe
 * consumers see {@link MessageShim#recordSubcribeConsumer}
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
 * @param {MessageSpec|MessageFunction} spec
 *  The spec for the method or a function which returns the details of the
 *  method.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
 * @see Shim#wrap
 * @see Shim#record
 * @see MessageShim#recordSubcribeConsumer
 * @see MessageSpec
 * @see MessageFunction
 */
function recordConsume(nodule, properties, spec) {
  if (this.isObject(properties) && !this.isArray(properties)) {
    // recordConsume(func, spec)
    spec = properties
    properties = null
  }
  var DEFAULT_SPEC = {
    destinationName: null,
    promise: false,
    callback: null,
    resultHandler: null
  }
  if (!this.isFunction(spec)) {
    spec = this.setDefaults(spec, DEFAULT_SPEC)
  }

  return this.wrap(nodule, properties, function wrapConsume(shim, fn, fnName) {
    if (!shim.isFunction(fn)) {
      shim.logger.debug('Not wrapping %s (%s) as consume', fn, fnName)
      return fn
    }

    return function consumeRecorder() {
      var parent = shim.getSegment()
      if (!parent || !parent.transaction.isActive()) {
        shim.logger.trace('Not recording consume, no active transaction.')
        return fn.apply(this, arguments)
      }

      // Process the message args.
      var args = shim.argsToArray.apply(shim, arguments)
      var msgDesc = null
      if (shim.isFunction(spec)) {
        msgDesc = spec.call(this, shim, fn, fnName, args)
        shim.setDefaults(msgDesc, DEFAULT_SPEC)
      } else {
        msgDesc = {
          destinationName: null,
          callback: spec.callback,
          promise: spec.promise,
          resultHandler: spec.resultHandler
        }

        var destIdx = shim.normalizeIndex(args.length, spec.destinationName)
        if (destIdx !== null) {
          msgDesc.destinationName = args[destIdx]
        }
      }

      // Make the segment if we can.
      if (!msgDesc) {
        shim.logger.trace('Not recording consume, no message descriptor.')
        return fn.apply(this, args)
      }
      var name = _nameMessageSegment(shim, msgDesc, shim._metrics.CONSUME)
      var segment = shim.createSegment(name, genericRecorder, parent)
      var getParams = shim.agent.config.message_tracer.segment_parameters.enabled
      var resHandler = shim.isFunction(msgDesc.resultHandler)
        ? msgDesc.resultHandler : null

      // If we have a callback and a results handler, then wrap the callback so
      // we can call the results handler and get the message properties.
      if (resHandler) {
        var cbIdx = shim.normalizeIndex(args.length, msgDesc.callback)
        if (cbIdx !== null) {
          shim.wrap(args, cbIdx, function wrapCb(shim, cb, cbName) {
            if (shim.isFunction(cb)) {
              return function cbWrapper() {
                var cbArgs = shim.argsToArray.apply(shim, arguments)
                var msgProps = resHandler.call(this, shim, cb, cbName, cbArgs)
                if (getParams && msgProps && msgProps.parameters) {
                  shim.copySegmentParameters(segment, msgProps.parameters)
                }

                return cb.apply(this, arguments)
              }
            }
          })
        }
      }

      // Call the method in the context of our segment.
      var ret = shim.applySegment(fn, segment, true, this, args)

      // Intercept the promise to handle the result.
      if (resHandler && ret && msgDesc.promise && shim.isPromise(ret)) {
        ret = ret.then(function interceptValue(res) {
          var msgProps = resHandler.call(this, shim, fn, fnName, res)
          if (getParams && msgProps && msgProps.parameters) {
            shim.copySegmentParameters(segment, msgProps.parameters)
          }
          return res
        })
      }

      return ret
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
 * - `recordSubcribeConsumer(nodule, properties, spec)`
 * - `recordSubcribeConsumer(func, spec)`
 *
 * Message subscriber methods are ones used to register a message consumer with
 * the message library. See {@link MessageShim#recordConsume} for recording
 * the consumer itself.
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
 * @see MessageShim#recordConsume
 * @see MessageSubscribeSpec
 */
function recordSubcribeConsumer(nodule, properties, spec) {
  if (!nodule) {
    this.logger.debug('Not wrapping non-existent nodule.')
    return nodule
  }

  // Sort out the parameters.
  if (this.isObject(properties) && !this.isArray(properties)) {
    // recordSubcribeConsumer(nodule, spec)
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
    this.logger.debug('spec.consumer is required for recordSubcribeConsumer')
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

    // if (checkCAT && segment && msgDesc.messageProperties) {
    //   shim.handleCATHeaders(msgDesc.messageProperties, segment)
    // }


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
 * @param {string}      action  - Produce or consume?
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
