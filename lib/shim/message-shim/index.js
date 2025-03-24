/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const genericRecorder = require('../../metrics/recorders/generic')
const logger = require('../../logger').child({ component: 'MessageShim' })
const TransactionShim = require('../transaction-shim')
const Shim = require('../shim') // For Shim.defineProperty
const util = require('util')
const { _nameMessageSegment } = require('./common')
const createRecorder = require('./consume')
const createSubscriberWrapper = require('./subscribe-consume')
const specs = require('../specs')

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
  RABBITMQ: 'RabbitMQ',
  SNS: 'SNS',
  SQS: 'SQS'
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
 * @typedef {Object<string, string>} MessageShimTypes
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
 * @class
 * @augments TransactionShim
 * @classdesc Used for instrumenting message broker client libraries.
 * @param {Agent} agent The agent this shim will use.
 * @param {string} moduleName The name of the module being instrumented.
 * @param {string} resolvedName The full path to the loaded module.
 * @param {string} shimName Used to persist shim ids across different shim instances.
 * @param {string} pkgVersion version of module
 * @see Shim
 * @see TransactionShim
 */
function MessageShim(agent, moduleName, resolvedName, shimName, pkgVersion) {
  TransactionShim.call(this, agent, moduleName, resolvedName, shimName, pkgVersion)
  this._logger = logger.child({ module: moduleName })
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
 * @summary
 *  Used for determining information about a message either being produced or
 *  consumed.
 * @param {MessageShim} shim
 *  The shim this function was handed to.
 * @param {Function} func
 *  The produce method or message consumer.
 * @param {string} name
 *  The name of the producer or consumer.
 * @param {Array.<*>} args
 *  The arguments being passed into the produce method or consumer.
 * @returns {specs.MessageSpec} The specification for the message being produced or
 *  consumed.
 * @see MessageShim#recordProduce
 * @see MessageShim#recordConsume
 */

/**
 * @callback MessageHandlerFunction
 * @summary
 *  A function that is used to extract properties from a consumed message. This
 *  method is handed the results of a consume call. If the consume used a
 *  callback, then this method will receive the arguments to the callback. If
 *  the consume used a promise, then this method will receive the resolved
 *  value.
 * @param {MessageShim} shim
 *  The shim this function was handed to.
 * @param {Function} func
 *  The produce method or message consumer.
 * @param {string} name
 *  The name of the producer or consumer.
 * @param {Array|*} args
 *  Either the arguments for the consumer callback function or the result of
 *  the resolved consume promise, depending on the mode of the instrumented
 *  method.
 * @returns {specs.MessageSpec} The extracted properties of the consumed message.
 * @see MessageShim#recordConsume
 */

/**
 * @callback MessageConsumerWrapperFunction
 * @summary
 *  Function that is used to wrap message consumer functions. Used alongside
 *  the MessageShim#recordSubscribedConsume API method.
 * @param {MessageShim} shim
 *  The shim this function was handed to.
 * @param {Function} consumer
 *  The message consumer to wrap.
 * @param {string} name
 *  The name of the consumer method.
 * @param {string} queue
 *  The name of the queue this consumer is being subscribed to.
 * @returns {Function} The consumer method, possibly wrapped.
 * @see MessageShim#recordSubscribedConsume
 * @see MessageShim#recordConsume
 */

// -------------------------------------------------------------------------- //

/**
 * Sets the vendor of the message broker being instrumented.
 *
 * This is used to generate the names for metrics and segments. If a string is
 * passed, metric names will be generated using that.
 *
 * @memberof MessageShim.prototype
 * @param {MessageShim.LIBRARY_NAMES|string} library
 *  The name of the message broker library. Use one of the well-known constants
 *  listed in {@link MessageShim.LIBRARY_NAMES} if available for the library.
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

  this._logger = this._logger.child({ library })
  this.logger.trace({ metrics: this._metrics }, 'Library metric names set')
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
 * @param {object | Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 * @param {MessageFunction} recordNamer
 *  A function which specifies details of the message.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its properties.
 * @see Shim#wrap
 * @see Shim#record
 * @see specs.MessageSpec
 * @see MessageFunction
 */
function recordProduce(nodule, properties, recordNamer) {
  if (this.isFunction(properties)) {
    // recordProduce(func, recordNamer)
    recordNamer = properties
    properties = null
  }

  return this.record(nodule, properties, function recordProd(shim) {
    const msgDesc = recordNamer.apply(this, arguments)
    if (!msgDesc) {
      return null
    }

    msgDesc.name = _nameMessageSegment(shim, msgDesc, shim._metrics.PRODUCE)
    if (!shim.agent.config.message_tracer.segment_parameters.enabled) {
      delete msgDesc.parameters
    } else if (msgDesc.routingKey) {
      msgDesc.parameters = shim.setDefaults(msgDesc.parameters, {
        routing_key: msgDesc.routingKey
      })
    }

    msgDesc.inContext = function generateCATHeaders() {
      if (msgDesc.headers) {
        shim.insertCATRequestHeaders(msgDesc.headers, true)
      }

      if (msgDesc.messageHeaders) {
        // Some message broker clients, like kafkajs, allow for sending multiple
        // messages in one send. Clients are likely to pick up such messages
        // individually. Thus, we need to propagate any distributed trace
        // headers to every message in the payload.
        msgDesc.messageHeaders((headers, altNames = true) => {
          shim.insertCATRequestHeaders(headers, altNames)
        })
      }
    }
    msgDesc.recorder = genericRecorder
    return msgDesc
  })
}
/**
 *
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
 * @param {object | Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 * @param {specs.MessageSpec|MessageFunction} spec
 *  The spec for the method or a function which returns the details of the
 *  method.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its properties.
 * @see Shim#wrap
 * @see Shim#record
 * @see MessageShim#recordSubscribedConsume
 * @see specs.MessageSpec
 * @see MessageFunction
 */
function recordConsume(nodule, properties, spec) {
  if (this.isObject(properties) && !this.isArray(properties)) {
    // recordConsume(func, spec)
    spec = properties
    properties = null
  }

  return this.record(nodule, properties, function wrapConsume(shim, fn, fnName, args) {
    return createRecorder.call(this, { spec, shim, fn, fnName, args })
  })
}

/**
 * Wraps the given properties as queue purging methods.
 *
 * - `recordPurgeQueue(nodule, properties, spec)`
 * - `recordPurgeQueue(func, spec)`
 *
 * @memberof MessageShim.prototype
 * @param {object | Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 * @param {specs.MessageSpec} spec
 *  The specification for this queue purge method's interface.
 * @param {string} spec.queue
 *  The name of the queue being purged.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its properties.
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

  const specIsFunction = this.isFunction(spec)

  return this.record(nodule, properties, function purgeRecorder(shim, fn, name, args) {
    let descriptor = spec
    if (specIsFunction) {
      descriptor = spec.apply(this, arguments)
    }

    let queue = descriptor.queue
    if (shim.isNumber(queue)) {
      const queueIdx = shim.normalizeIndex(args.length, descriptor.queue)
      queue = args[queueIdx]
    }

    descriptor.name = _nameMessageSegment(
      shim,
      {
        destinationType: shim.QUEUE,
        destinationName: queue
      },
      shim._metrics.PURGE
    )
    descriptor.recorder = genericRecorder
    return descriptor
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
 * @param {object | Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 * @param {specs.MessageSubscribeSpec} spec
 *  The specification for this subscription method's interface.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its properties.
 * @see Shim#wrap
 * @see Shim#record
 * @see MessageShim#recordConsume
 * @see specs.MessageSubscribeSpec
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

  // Must wrap the subscribe method independently to ensure that we can wrap
  // the consumer regardless of transaction state.
  const wrapped = this.wrap(nodule, properties, function wrapSubscribe(shim, fn, name) {
    if (!shim.isFunction(fn)) {
      return fn
    }

    return createSubscriberWrapper.call(this, { shim, fn, spec, name })
  })

  // Wrap the subscriber with segment creation.
  return this.record(wrapped, properties, function recordSubscribe(shim, fn, name, args) {
    if (shim.isFunction(spec)) {
      spec = spec.call(this, shim, fn, name, args)
    }
    // Make sure the specified consumer and callback indexes do not overlap.
    // This could happen for instance if the function signature is
    // `fn(consumer [, callback])` and specified as `consumer: shim.FIRST`,
    // `callback: shim.LAST`.
    const consumerIdx = shim.normalizeIndex(args.length, spec.consumer)
    let cbIdx = shim.normalizeIndex(args.length, spec.callback)
    if (cbIdx === consumerIdx) {
      cbIdx = null
    }

    return new specs.RecorderSpec({
      name: spec.name || name,
      callback: cbIdx,
      promise: spec.promise,
      parameters: spec.parameters,
      stream: false,
      internal: false
    })
  })
}
