/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

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
for (const [name, type] of Object.entries(Transaction.TYPES)) {
  Shim.defineProperty(TransactionShim, name, type)
  Shim.defineProperty(TransactionShim.prototype, name, type)
}

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
TransactionShim.prototype.insertDTRequestHeaders = insertDTRequestHeaders

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
 * Transactions are named for the middleware that sends the response. Some web
 * frameworks are capable of mounting middleware in complex routing stacks. In
 * order to maintain the correct name, transactions keep a stack of mount points
 * for each middleware/router/app/whatever. The instrumentation should push on
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
 * Retrieves DT headers may be in the given headers.
 *
 * - `handleMqTracingHeaders(headers [, segment ] [, transportType], [, transaction])`
 *
 * @memberof TransactionShim.prototype
 *
 * This will check for DT headers and add to transaction
 * @param {object} headers
 *  The request/response headers object to look in.
 * @param {TraceSegment} [segment]
 *  The trace segment to associate the header data with. If no segment is
 *  provided then the currently active segment is used.
 * @param {string} [transportType]
 *  The transport type that brought the headers. Usually `HTTP` or `HTTPS`.
 * @param {Transaction} transaction active transaction
 */
function handleMqTracingHeaders(headers, segment, transportType, transaction) {
  // Check that we're in an active transaction.
  const currentSegment = segment || this.getSegment()
  transaction = transaction || this.tracer.getTransaction()
  if (!currentSegment || !transaction.isActive()) {
    this.logger.trace('Not processing headers for DT, not in an active transaction.')
    return
  }

  transaction.addDtHeaders({ headers, transport: transportType })
}

/**
 * Adds DT headers for an outbound request.
 *
 * - `insertDTRequestHeaders(headers)`
 *
 * @memberof TransactionShim.prototype
 * @param {object} headers
 *  The outbound request headers object to inject our DT headers into.
 */
function insertDTRequestHeaders(headers) {
  const tx = this.tracer.getTransaction()
  if (!tx || !tx.isActive()) {
    this.logger.trace('No active transaction found, not adding headers.')
    return
  }

  tx.insertDistributedTraceHeaders(headers)
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
 * @param {Function} func
 *  The function link with the transaction.
 * @param {string} name
 *  The name of the wrapped function.
 * @param {TransactionSpec} spec
 *  The spec for the transaction to create.
 * @returns {Function} A function which wraps `fn` and creates potentially nested
 *  transactions linked to its execution.
 */
function _makeNestedTransWrapper(shim, func, name, spec) {
  return function nestedTransactionWrapper() {
    if (!shim.agent.canCollectData()) {
      return func.apply(this, arguments)
    }

    let context = shim.tracer.getContext()
    let transaction = shim.tracer.getTransaction()

    // Only create a new transaction if we either do not have a current
    // transaction _or_ the current transaction is not of the type we want.
    if (!transaction || spec.type !== transaction?.type) {
      shim.logger.trace('Creating new nested %s transaction for %s', spec.type, name)
      transaction = new Transaction(shim.agent)
      transaction.type = spec.type
      context = context.enterTransaction(transaction)
    }

    return shim.applyContext({ func, context, full: false, boundThis: this, args: arguments })
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
 * @param {Function} func
 *  The function link with the transaction.
 * @param {string} name
 *  The name of the wrapped function.
 * @param {TransactionSpec} spec
 *  The spec for the transaction to create.
 * @returns {Function} A function which wraps `fn` and potentially creates a new
 *  transaction linked to the function's execution.
 */
function _makeTransWrapper(shim, func, name, spec) {
  return function transactionWrapper() {
    let context = shim.tracer.getContext()
    // Don't nest transactions, reuse existing ones!
    const existingTransaction = shim.tracer.getTransaction()
    if (!shim.agent.canCollectData() || existingTransaction) {
      shim.logger.trace('Transaction %s exists, not creating new transaction %s for %s', existingTransaction?.id, spec.type, name)
      return func.apply(this, arguments)
    }

    shim.logger.trace('Creating new %s transaction for %s', spec.type, name)
    const transaction = new Transaction(shim.agent)
    transaction.type = spec.type
    context = context.enterTransaction(transaction)
    return shim.applyContext({ func, context, full: false, boundThis: this, args: arguments })
  }
}
