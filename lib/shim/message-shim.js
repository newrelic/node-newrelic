'use strict'

var copy = require('../util/copy')
var genericRecorder = require('../metrics/recorders/generic')
var logger = require('../logger').child({component: 'MessageShim'})
var messageTransactionRecorder = require('../metrics/recorders/message-transaction')
var props = require('../util/properties')
var TransactionShim = require('./transaction-shim')
var Shim = require('./shim') // For Shim.defineProperty
var util = require('util')

var ATTR_DESTS = require('../config/attribute-filter').DESTINATIONS


/**
 * Enumeration of well-known message brokers.
 *
 * @readonly
 * @memberof MessageShim
 * @enum {string}
 */
const LIBRARY_NAMES = {
  IRONMQ: 'IronMQ',
  KAFKA: 'Kafka',
  RABBITMQ: 'RabbitMQ'
}

/**
 * Mapping of well-known message brokers to their distributed tracing transport
 * type.
 *
 * @private
 * @readonly
 * @enum {string}
 */
const LIBRARY_TRANSPORT_TYPES = {
  AMQP: TransactionShim.TRANSPORT_TYPES.AMQP,
  IronMQ: TransactionShim.TRANSPORT_TYPES.IRONMQ,
  Kafka: TransactionShim.TRANSPORT_TYPES.KAFKA,
  RabbitMQ: TransactionShim.TRANSPORT_TYPES.AMQP
}

/**
 * Enumeration of possible message broker destination types.
 *
 * @readonly
 * @memberof MessageShim
 * @enum {string}
 */
const DESTINATION_TYPES = {
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
  this._transportType = TransactionShim.TRANSPORT_TYPES.UNKNOWN
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
MessageShim.prototype.recordSubscribedConsume = recordSubscribedConsume

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
 * @return {MessageSpec} The extracted properties of the consumed message.
 *
 * @see MessageShim#recordConsume
 */

/**
 * @callback MessageConsumerWrapperFunction
 *
 * @summary
 *  Function that is used to wrap message consumer functions. Used along side
 *  the MessageShim#recordSubscribedConsume API method.
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
 * @see MessageShim#recordSubscribedConsume
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
 * @property {Object} [headers=null]
 *  A reference to the message headers. On produce, more headers will be added
 *  to this object which should be sent along with the message. On consume,
 *  cross-application headers will be read from this object.
 *
 * @property {string} [routingKey=null]
 *  The routing key for the message. If provided on consume, the routing key
 *  will be added to the transaction attributes as `message.routingKey`.
 *
 * @property {string} [queue=null]
 *  The name of the queue the message was consumed from. If provided on
 *  consume, the queue name will be added to the transaction attributes as
 *  `message.queueName`.
 *
 * @property {string} [parameters.correlation_id]
 *  In AMQP, this should be the correlation Id of the message, if it has one.
 *
 * @property {string} [parameters.reply_to]
 *  In AMQP, this should be the name of the queue to reply to, if the message
 *  has one.
 *
 * @property {MessageHandlerFunction} [messageHandler]
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
 * @interface MessageSubscribeSpec
 * @extends MessageSpec
 *
 * @description
 *  Specification for message subscriber methods. That is, methods which
 *  register a consumer to start receiving messages.
 *
 * @property {number} consumer
 *  The index of the consumer in the method's arguments. Note that if the
 *  consumer and callback indexes point to the same argument, the argument will
 *  be wrapped as a consumer.
 *
 * @property {MessageHandlerFunction} messageHandler
 *  A function to extract message properties from a consumed message.
 *  This method is only used in the consume case to pull data from the
 *  retrieved message. Its return value is combined with the `MessageSubscribeSpec`
 *  to fully describe the consumed message.
 *
 * @see MessageSpec
 * @see MessageConsumerWrapperFunction
 * @see MessageShim#recordSubscribedConsume
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

  if (LIBRARY_TRANSPORT_TYPES[library]) {
    this._transportType = LIBRARY_TRANSPORT_TYPES[library]
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
      inContext: function generateCATHeaders() {
        if (msgDesc.headers) {
          shim.insertCATRequestHeaders(msgDesc.headers, true)
        }
      },
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
 * consumers see {@link MessageShim#recordSubscribedConsume}
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
 * @see MessageShim#recordSubscribedConsume
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
    messageHandler: null
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
          messageHandler: spec.messageHandler
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
      var resHandler = shim.isFunction(msgDesc.messageHandler)
        ? msgDesc.messageHandler : null

      // If we have a callback and a results handler, then wrap the callback so
      // we can call the results handler and get the message properties.
      if (resHandler) {
        var cbIdx = shim.normalizeIndex(args.length, msgDesc.callback)
        if (cbIdx !== null) {
          shim.bindCallbackSegment(args, cbIdx, segment)
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
 * - `recordSubscribedConsume(nodule, properties, spec)`
 * - `recordSubscribedConsume(func, spec)`
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
function recordSubscribedConsume(nodule, properties, spec) {
  if (!nodule) {
    this.logger.debug('Not wrapping non-existent nodule.')
    return nodule
  }

  // Sort out the parameters.
  if (this.isObject(properties) && !this.isArray(properties)) {
    // recordSubscribedConsume(nodule, spec)
    spec = properties
    properties = null
  }

  // Fill the spec with defaults.
  spec = this.setDefaults(spec, {
    name: null,
    destinationName: null,
    destinationType: null,
    consumer: null,
    callback: null,
    messageHandler: null,
    promise: false
  })

  // Make sure our spec has what we need.
  if (!this.isFunction(spec.messageHandler)) {
    this.logger.debug('spec.messageHandler should be a function')
    return nodule
  } else if (!this.isNumber(spec.consumer)) {
    this.logger.debug('spec.consumer is required for recordSubscribedConsume')
    return nodule
  }

  var destNameIsArg = this.isNumber(spec.destinationName)

  // Must wrap the subscribe method independently to ensure that we can wrap
  // the consumer regardless of transaction state.
  var wrapped = this.wrap(nodule, properties, function wrapSubscribe(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }
    return function wrappedSubscribe() {
      var args = shim.argsToArray.apply(shim, arguments)
      var queueIdx = shim.normalizeIndex(args.length, spec.queue)
      var consumerIdx = shim.normalizeIndex(args.length, spec.consumer)
      var queue = queueIdx === null ? null : args[queueIdx]
      var destName = null

      if (destNameIsArg) {
        var destNameIdx = shim.normalizeIndex(args.length, spec.destinationName)
        if (destNameIdx !== null) {
          destName = args[destNameIdx]
        }
      }

      if (consumerIdx !== null) {
        args[consumerIdx] = shim.wrap(
          args[consumerIdx],
          makeWrapConsumer(queue, destName)
        )
      }

      return fn.apply(this, args)
    }
  })

  // Wrap the subscriber with segment creation.
  return this.record(wrapped, properties, function recordSubscribe(shim, fn, name, args) {
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

  function makeWrapConsumer(queue, destinationName) {
    var msgDescDefaults = copy.shallow(spec)
    if (destNameIsArg && destinationName != null) {
      msgDescDefaults.destinationName = destinationName
    }
    if (queue != null) {
      msgDescDefaults.queue = queue
    }

    return function wrapConsumer(shim, consumer, cName) {
      if (!shim.isFunction(consumer)) {
        return consumer
      }

      return shim.bindCreateTransaction(function createConsumeTrans() {
        // If there is no transaction or we're in a pre-existing transaction,
        // then don't do anything. Note that the latter should never happen.
        var args = shim.argsToArray.apply(shim, arguments)
        var tx = shim.tracer.getTransaction()

        if (!tx || tx.baseSegment) {
          shim.logger.debug({transaction: !!tx}, 'Failed to start message transaction.')
          return consumer.apply(this, args)
        }

        var msgDesc = spec.messageHandler.call(this, shim, consumer, cName, args)

        // If message could not be handled, immediately kill this transaction.
        if (!msgDesc) {
          shim.logger.debug('No description for message, cancelling transaction.')
          tx.setForceIgnore(true)
          tx.end()
          return consumer.apply(this, args)
        }

        // Derive the transaction name.
        shim.setDefaults(msgDesc, msgDescDefaults)
        var txName = _nameMessageTransaction(shim, msgDesc)
        tx.setPartialName(txName)
        tx.baseSegment = shim.createSegment({
          name: tx.getFullName(),
          recorder: messageTransactionRecorder
        })

        // Add would-be baseSegment attributes to transaction trace
        for (var key in msgDesc.parameters) {
          if (props.hasOwn(msgDesc.parameters, key)) {
            tx.trace.addAttribute(
              ATTR_DESTS.NONE,
              'message.parameters.' + key,
              msgDesc.parameters[key])
          }
        }

        // If we have a routing key, add it to the transaction. Note that it is
        // camel cased here, but snake cased in the segment parameters.
        if (!shim.agent.config.high_security) {
          if (msgDesc.routingKey) {
            tx.trace.addAttribute(
              ATTR_DESTS.COMMON,
              'message.routingKey',
              msgDesc.routingKey
            )
          }
          if (shim.isString(msgDesc.queue)) {
            tx.trace.addAttribute(ATTR_DESTS.COMMON, 'message.queueName', msgDesc.queue)
          }
        }
        if (msgDesc.headers) {
          shim.handleCATHeaders(msgDesc.headers, tx.baseSegment, shim._transportType)
        }

        shim.logger.trace('Started message transaction %s named %s', tx.id, txName)

        // Execute the original function and attempt to hook in the transaction
        // finish.
        var ret = null
        try {
          ret = shim.applySegment(consumer, tx.baseSegment, true, this, args)
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
        nest: true
      })
    }
  }
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

function _nameMessageTransaction(shim, msgDesc) {
  var name =
    shim._metrics.LIBRARY + '/' +
    (msgDesc.destinationType || shim.EXCHANGE) + '/'

  if (msgDesc.destinationName) {
    name += shim._metrics.NAMED + msgDesc.destinationName
  } else {
    name += shim._metrics.TEMP
  }

  return name
}
