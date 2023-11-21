/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const cat = require('../util/cat')
const logger = require('../logger').child({ component: 'TransactionShim' })
const Shim = require('./shim')
const Transaction = require('../transaction')
const util = require('util')

const TRANSACTION_TYPES_SET = Transaction.TYPES_SET

/**
 * Constructs a transaction managing shim.
 *
 * @class
 * @augments Shim
 * @classdesc
 * @param shimName
 *  A helper class for working with transactions.
 * @param {Agent}   agent         - The agent the shim will use.
 * @param {string}  moduleName    - The name of the module being instrumented.
 * @param {string}  resolvedName  - The full path to the loaded module.
 * @param {string}  shimName       - Used to persist shim ids across different shim instances.
 * @param {string}  pkgVersion     - version of module
 * @see Shim
 * @see WebFrameworkShim
 */
function TransactionShim(agent, moduleName, resolvedName, shimName, pkgVersion) {
  Shim.call(this, agent, moduleName, resolvedName, shimName, pkgVersion)
  this._logger = logger.child({ module: moduleName })
}
module.exports = TransactionShim
util.inherits(TransactionShim, Shim)

/**
 * Enumeration of transaction types.
 *
 * Each of these values is also exposed directly on the `TransactionShim` class
 * as static members.
 *
 * @readonly
 * @memberof TransactionShim.prototype
 * @enum {string}
 */
TransactionShim.TRANSACTION_TYPES = Transaction.TYPES
Object.keys(Transaction.TYPES).forEach(function defineTypeEnum(type) {
  Shim.defineProperty(TransactionShim, type, Transaction.TYPES[type])
  Shim.defineProperty(TransactionShim.prototype, type, Transaction.TYPES[type])
})

/**
 * Enumeration of possible transaction transport types used for distributed tracing.
 *
 * This enumeration is also exposed on the `TransactionShim` class.
 *
 * @readonly
 * @memberof TransactionShim.prototype
 * @enum {string}
 */
Shim.defineProperty(TransactionShim, 'TRANSPORT_TYPES', Transaction.TRANSPORT_TYPES)
Shim.defineProperty(TransactionShim.prototype, 'TRANSPORT_TYPES', Transaction.TRANSPORT_TYPES)

TransactionShim.prototype.bindCreateTransaction = bindCreateTransaction
TransactionShim.prototype.pushTransactionName = pushTransactionName
TransactionShim.prototype.popTransactionName = popTransactionName
TransactionShim.prototype.setTransactionName = setTransactionName
TransactionShim.prototype.handleMqTracingHeaders = handleMqTracingHeaders
TransactionShim.prototype.insertCATReplyHeader = insertCATReplyHeader
TransactionShim.prototype.insertCATRequestHeaders = insertCATRequestHeaders

// -------------------------------------------------------------------------- //

/**
 * @interface TransactionSpec
 * @description
 *  Describes the type of transaction to be created by the function being
 *  wrapped by {@link Shim#bindCreateTransaction}.
 * @property {string} type
 *  The type of transaction to create. Must be one of the values from
 *  {@link Shim#TRANSACTION_TYPES}.
 * @property {boolean} [nest=false]
 *  Indicates if the transaction being created is allowed to be nested within
 *  another transaction of the same type. If `false`, the default, the transaction
 *  will only be created if there is no existing transaction, or the current
 *  transaction is of a different type. If `true`, the transaction will be
 *  created regardless of the current transaction's type.
 * @see Shim#bindCreateTransaction
 * @see Shim#TRANSACTION_TYPES
 */

// -------------------------------------------------------------------------- //

/**
 * Wraps one or more functions such that new transactions are created when
 * invoked.
 *
 * - `bindCreateTransaction(nodule, property, spec)`
 * - `bindCreateTransaction(func, spec)`
 *
 * @memberof TransactionShim.prototype
 * @param {object | Function} nodule
 *  The source for the property to wrap, or a single function to wrap.
 * @param {string} [property]
 *  The property to wrap. If omitted, the `nodule` parameter is assumed to be
 *  the function to wrap.
 * @param {TransactionSpec} spec
 *  The spec for creating the transaction.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its property.
 */
function bindCreateTransaction(nodule, property, spec) {
  if (this.isObject(property) && !this.isArray(property)) {
    // bindCreateTransaction(nodule, spec)
    spec = property
    property = null
  }

  // Refuse to perform the wrapping if `spec.type` is not valid.
  if (!TRANSACTION_TYPES_SET[spec.type]) {
    this.logger.error(
      { stack: new Error().stack },
      'Invalid spec type "%s", must be one of %j.',
      spec.type,
      Object.keys(TRANSACTION_TYPES_SET)
    )
    return nodule
  }

  // Perform the actual wrapping.
  return this.wrap(nodule, property, function makeTransWrapper(shim, fn, name) {
    if (!shim.isFunction(fn)) {
      shim.logger.debug('Not wrapping "%s" with transaction, not a function.', name)
      return fn
    }

    // Is this transaction supposed to be nested? Pick the right wrapper for the
    // job.
    const makeWrapper = spec.nest ? _makeNestedTransWrapper : _makeTransWrapper
    return makeWrapper(shim, fn, name, spec)
  })
}

/**
 * Pushes a new path segment onto the transaction naming stack.
 *
 * - `pushTransactionName(pathSegment)`
 *
 * Transactions are named for the middlware that sends the response. Some web
 * frameworks are capable of mounting middlware in complex routing stacks. In
 * order to maintain the correct name, transactions keep a stack of mount points
 * for each middlware/router/app/whatever. The instrumentation should push on
 * the mount path for wrapped things when route resolution enters and pop it
 * back off when resolution exits the item.
 *
 * @memberof TransactionShim.prototype
 * @param {string} pathSegment - The path segment to add to the naming stack.
 */
function pushTransactionName(pathSegment) {
  const tx = this.tracer.getTransaction()
  if (tx && tx.nameState) {
    tx.nameState.appendPath(pathSegment)
  }
}

/**
 * Pops one or more elements off the transaction naming stack.
 *
 * - `popTransactionName([pathSegment])`
 *
 * Ideally it is not necessary to ever provide the `pathSegment` parameter for
 * this function, but we do not live in an ideal world.
 *
 * @memberof TransactionShim.prototype
 * @param {string} [pathSegment]
 *  Optional. Path segment to pop the stack repeatedly until a segment matching
 *  `pathSegment` is removed.
 */
function popTransactionName(pathSegment) {
  const tx = this.tracer.getTransaction()
  if (tx && tx.nameState) {
    tx.nameState.popPath(pathSegment)
  }
}

/**
 * Sets the name to be used for this transaction.
 *
 * - `setTransactionName(name)`
 *
 * Either this _or_ the naming stack should be used. Do not use them together.
 *
 * @memberof TransactionShim.prototype
 * @param {string} name - The name to use for the transaction.
 */
function setTransactionName(name) {
  const tx = this.tracer.getTransaction()
  if (tx) {
    tx.setPartialName(name)
  }
}

/**
 * Retrieves whatever CAT headers may be in the given headers.
 *
 * - `handleMqTracingHeaders(headers [, segment [, transportType]])`
 *
 * @memberof TransactionShim.prototype
 *
 * This will check for either header naming style, and both request and reply
 * CAT headers.
 * @param {object} headers
 *  The request/response headers object to look in.
 * @param {TraceSegment} [segment=null]
 *  The trace segment to associate the header data with. If no segment is
 *  provided then the currently active segment is used.
 * @param {string} [transportType='Unknown']
 *  The transport type that brought the headers. Usually `HTTP` or `HTTPS`.
 */
function handleMqTracingHeaders(headers, segment, transportType) {
  // TODO: replace functionality when CAT fully removed.

  if (!headers) {
    this.logger.debug('No headers for CAT or DT processing.')
    return
  }

  const config = this.agent.config

  if (!config.cross_application_tracer.enabled && !config.distributed_tracing.enabled) {
    this.logger.trace('CAT and DT disabled, not extracting headers.')
    return
  }

  // Check that we're in an active transaction.
  const currentSegment = segment || this.getSegment()
  if (!currentSegment || !currentSegment.transaction.isActive()) {
    this.logger.trace('Not processing headers for CAT or DT, not in an active transaction.')
    return
  }

  const transaction = currentSegment.transaction

  if (config.distributed_tracing.enabled) {
    transaction.acceptDistributedTraceHeaders(transportType, headers)
    return
  }

  // Not DT so processing CAT.
  // TODO: Below will be removed when CAT removed.
  const { appData, id, transactionId } = cat.extractCatHeaders(headers)
  const { externalId, externalTransaction } = cat.parseCatData(
    id,
    transactionId,
    config.encoding_key
  )
  cat.assignCatToTransaction(externalId, externalTransaction, transaction)
  const decodedAppData = cat.parseAppData(config, appData)
  cat.assignCatToSegment(decodedAppData, currentSegment)
  // TODO: Handle adding ExternalTransaction metrics for this segment.
}

/**
 * Adds CAT headers for an outbound request.
 *
 * - `insertCATRequestHeaders(headers [, useAlternateHeaderNames])`
 *
 * @memberof TransactionShim.prototype
 * @param {object} headers
 *  The outbound request headers object to inject our CAT headers into.
 * @param {boolean} [useAlternateHeaderNames=false]
 *  Indicates if HTTP-style headers should be used or alternate style. Some
 *  transport protocols are more strict on the characters allowed in headers
 *  and this option can be used to toggle use of pure-alpha header names.
 */
// TODO: abstract header logic shared with wrapRequest in http instrumentation
function insertCATRequestHeaders(headers, useAlternateHeaderNames) {
  const crossAppTracingEnabled = this.agent.config.cross_application_tracer.enabled
  const distributedTracingEnabled = this.agent.config.distributed_tracing.enabled

  if (!distributedTracingEnabled && !crossAppTracingEnabled) {
    this.logger.trace('Distributed Tracing and CAT are both disabled, not adding headers.')
    return
  }

  if (!headers) {
    this.logger.debug('Missing headers object, not adding headers!')
    return
  }

  const tx = this.tracer.getTransaction()
  if (!tx || !tx.isActive()) {
    this.logger.trace('No active transaction found, not adding headers.')
    return
  }

  if (distributedTracingEnabled) {
    // TODO: Should probably honor symbols.disableDT.
    // TODO: Official testing and support.
    tx.insertDistributedTraceHeaders(headers)
  } else {
    cat.addCatHeaders(this.agent.config, tx, headers, useAlternateHeaderNames)
  }
}

/**
 * Adds CAT headers for an outbound response.
 *
 * - `insertCATReplyHeaders(headers [, useAlternateHeaderNames])`
 *
 * @memberof TransactionShim.prototype
 * @param {object} headers
 *  The outbound response headers object to inject our CAT headers into.
 * @param {boolean} [useAlternateHeaderNames=false]
 *  Indicates if HTTP-style headers should be used or alternate style. Some
 *  transport protocols are more strict on the characters allowed in headers
 *  and this option can be used to toggle use of pure-alpha header names.
 */
function insertCATReplyHeader(headers, useAlternateHeaderNames) {
  // Is CAT enabled?
  const config = this.agent.config
  if (!config.cross_application_tracer.enabled) {
    this.logger.trace('CAT disabled, not adding CAT reply header.')
    return
  } else if (config.distributed_tracing.enabled) {
    this.logger.warn('Distributed tracing is enabled, not adding CAT reply header.')
    return
  } else if (!config.encoding_key) {
    this.logger.warn('Missing encoding key, not adding CAT reply header!')
    return
  } else if (!headers) {
    this.logger.debug('Missing headers object, not adding CAT reply header!')
    return
  }

  // Are we in a transaction?
  const segment = this.getSegment()
  if (!segment || !segment.transaction.isActive()) {
    this.logger.trace('Not adding CAT reply header, not in an active transaction.')
    return
  }
  const tx = segment.transaction

  // Hunt down the content length.
  // NOTE: In AMQP, content-type and content-encoding are guaranteed fields, but
  // there is no content-length field or header. For that, content length will
  // always be -1.
  let contentLength = -1
  for (const key in headers) {
    if (key.toLowerCase() === 'content-length') {
      contentLength = headers[key]
      break
    }
  }

  const { key, data } = cat.encodeAppData(config, tx, contentLength, useAlternateHeaderNames)
  // Add the header.
  if (key && data) {
    headers[key] = data
    this.logger.trace('Added outbound response CAT headers for transaction %s', tx.id)
  }
}

/**
 * Creates a function that binds transactions to the execution of the function.
 *
 * The created transaction may be nested within an existing transaction if
 * `spec.type` is not the same as the current transaction's type.
 *
 * @private
 * @param {Shim} shim
 *  The shim used for the binding.
 * @param {Function} fn
 *  The function link with the transaction.
 * @param {string} name
 *  The name of the wrapped function.
 * @param {TransactionSpec} spec
 *  The spec for the transaction to create.
 * @returns {Function} A function which wraps `fn` and creates potentially nested
 *  transactions linked to its execution.
 */
function _makeNestedTransWrapper(shim, fn, name, spec) {
  return function nestedTransactionWrapper() {
    if (!shim.agent.canCollectData()) {
      return fn.apply(this, arguments)
    }

    // Reuse existing transactions only if the type matches.
    let transaction = shim.tracer.getTransaction()
    let segment = shim.getSegment()

    // Only create a new transaction if we either do not have a current
    // transaction _or_ the current transaction is not of the type we want.
    if (!transaction || spec.type !== transaction.type) {
      shim.logger.trace('Creating new nested %s transaction for %s', spec.type, name)
      transaction = new Transaction(shim.agent)
      transaction.type = spec.type
      segment = transaction.trace.root
    }

    return shim.applySegment(fn, segment, false, this, arguments)
  }
}

/**
 * Creates a function that binds transactions to the execution of the function.
 *
 * A transaction will only be created if there is not a currently active one.
 *
 * @private
 * @param {Shim} shim
 *  The shim used for the binding.
 * @param {Function} fn
 *  The function link with the transaction.
 * @param {string} name
 *  The name of the wrapped function.
 * @param {TransactionSpec} spec
 *  The spec for the transaction to create.
 * @returns {Function} A function which wraps `fn` and potentially creates a new
 *  transaction linked to the function's execution.
 */
function _makeTransWrapper(shim, fn, name, spec) {
  return function transactionWrapper() {
    // Don't nest transactions, reuse existing ones!
    const existingTransaction = shim.tracer.getTransaction()
    if (!shim.agent.canCollectData() || existingTransaction) {
      return fn.apply(this, arguments)
    }

    shim.logger.trace('Creating new %s transaction for %s', spec.type, name)
    const transaction = new Transaction(shim.agent)
    transaction.type = spec.type
    return shim.applySegment(fn, transaction.trace.root, false, this, arguments)
  }
}
