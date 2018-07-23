'use strict'

var cat = require('../util/cat')
var hashes = require('../util/hashes')
var logger = require('../logger').child({component: 'TransactionShim'})
var Shim = require('./shim')
var Transaction = require('../transaction')
var util = require('util')

const DISTRIBUTED_TRACE_HEADER = 'newrelic'
const HTTP_CAT_ID_HEADER = 'X-NewRelic-Id'
const MQ_CAT_ID_HEADER = 'NewRelicID'
const MATCH_CAT_ID_HEADER = new RegExp(
  '^(?:' + HTTP_CAT_ID_HEADER + '|' + MQ_CAT_ID_HEADER + ')$',
  'i'
)
const HTTP_CAT_TRANSACTION_HEADER = 'X-NewRelic-Transaction'
const MQ_CAT_TRANSACTION_HEADER = 'NewRelicTransaction'
const MATCH_CAT_TRANSACTION_HEADER = new RegExp(
  '^(?:' + HTTP_CAT_TRANSACTION_HEADER + '|' + MQ_CAT_TRANSACTION_HEADER + ')$',
  'i'
)
const HTTP_CAT_APP_DATA_HEADER = 'X-NewRelic-App-Data'
const MQ_CAT_APP_DATA_HEADER = 'NewRelicAppData'
const MATCH_CAT_APP_DATA_HEADER = new RegExp(
  '^(?:' + HTTP_CAT_APP_DATA_HEADER + '|' + MQ_CAT_APP_DATA_HEADER + ')$',
  'i'
)

const TRANSACTION_TYPES_SET = Transaction.TYPES_SET
const TRANSPORT_TYPES_SET = Transaction.TRANSPORT_TYPES_SET

/**
 * Constructs a transaction managing shim.
 *
 * @constructor
 * @extends Shim
 * @classdesc
 *  A helper class for working with transactions.
 *
 * @param {Agent}   agent         - The agent the shim will use.
 * @param {string}  moduleName    - The name of the module being instrumented.
 * @param {string}  resolvedName  - The full path to the loaded module.
 *
 * @see Shim
 * @see WebFrameworkShim
 */
function TransactionShim(agent, moduleName, resolvedName) {
  Shim.call(this, agent, moduleName, resolvedName)
  this._logger = logger.child({module: moduleName})
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
Shim.defineProperty(
  TransactionShim,
  'TRANSPORT_TYPES',
  Transaction.TRANSPORT_TYPES
)
Shim.defineProperty(
  TransactionShim.prototype,
  'TRANSPORT_TYPES',
  Transaction.TRANSPORT_TYPES
)

TransactionShim.prototype.bindCreateTransaction = bindCreateTransaction
TransactionShim.prototype.pushTransactionName = pushTransactionName
TransactionShim.prototype.popTransactionName = popTransactionName
TransactionShim.prototype.setTransactionName = setTransactionName
TransactionShim.prototype.handleCATHeaders = handleCATHeaders
TransactionShim.prototype.insertCATRequestHeaders = insertCATRequestHeaders
TransactionShim.prototype.insertCATReplyHeader = insertCATReplyHeader

// -------------------------------------------------------------------------- //

/**
 * @interface TransactionSpec
 *
 * @description
 *  Describes the type of transaction to be created by the function being
 *  wrapped by {@link Shim#bindCreateTransaction}.
 *
 * @property {string} type
 *  The type of transaction to create. Must be one of the values from
 *  {@link Shim#TRANSACTION_TYPES}.
 *
 * @property {bool} [nest=false]
 *  Indicates if the transaction being created is allowed to be nested within
 *  another transaction of the same type. If `false`, the default, the transaction
 *  will only be created if there is no existing transaction, or the current
 *  transaction is of a different type. If `true`, the transaction will be
 *  created regardless of the current transaction's type.
 *
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
 *
 * @param {Object|Function} nodule
 *  The source for the property to wrap, or a single function to wrap.
 *
 * @param {string} [property]
 *  The property to wrap. If omitted, the `nodule` parameter is assumed to be
 *  the function to wrap.
 *
 * @param {TransactionSpec} spec
 *  The spec for creating the transaction.
 *
 * @return {Object|Function} The first parameter to this function, after
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
      {stack: (new Error()).stack},
      'Invalid spec type "%s", must be one of %j.',
      spec.type, Object.keys(TRANSACTION_TYPES_SET)
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
    var makeWrapper = spec.nest ? _makeNestedTransWrapper : _makeTransWrapper
    return makeWrapper(shim, fn, name, spec)
  })
}

/**
 * Pushes a new path segment onto the transaction naming stack.
 *
 * - `pushTransactionName(pathSegment)`
 *
 * Transactions are named for the middlware that sends the reponse. Some web
 * frameworks are capable of mounting middlware in complex routing stacks. In
 * order to maintain the correct name, transactions keep a stack of mount points
 * for each middlware/router/app/whatever. The instrumentation should push on
 * the mount path for wrapped things when route resolution enters and pop it
 * back off when resolution exits the item.
 *
 * @memberof TransactionShim.prototype
 *
 * @param {string} pathSegment - The path segment to add to the naming stack.
 */
function pushTransactionName(pathSegment) {
  var tx = this.tracer.getTransaction()
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
 *
 * @param {string} [pathSegment]
 *  Optional. Path segment to pop the stack repeatedly until a segment matching
 *  `pathSegment` is removed.
 */
function popTransactionName(pathSegment) {
  var tx = this.tracer.getTransaction()
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
 *
 * @param {string} name - The name to use for the transaction.
 */
function setTransactionName(name) {
  var tx = this.tracer.getTransaction()
  if (tx) {
    tx.setPartialName(name)
  }
}

/**
 * Retrieves whatever CAT headers may be in the given headers.
 *
 * - `handleCATHeaders(headers [, segment [, transportType]])`
 *
 * @memberof TransactionShim.prototype
 *
 * This will check for either header naming style, and both request and reply
 * CAT headers.
 *
 * @param {object} headers
 *  The request/response headers object to look in.
 *
 * @param {TraceSegment} [segment=null]
 *  The trace segment to associate the header data with. If no segment is
 *  provided then the currently active segment is used.
 *
 * @param {string} [transportType='Unknown']
 *  The transport type that brought the headers. Usually `HTTP` or `HTTPS`.
 */
function handleCATHeaders(headers, segment, transportType) {
  // Is CAT enabled?
  if (!this.agent.config.cross_application_tracer.enabled) {
    this.logger.trace('CAT disabled, not extracting header.')
    return
  }
  if (!this.agent.config.encoding_key) {
    this.logger.warn('Missing encoding key, not extracting CAT headers!')
    return
  } else if (!headers) {
    this.logger.debug('No headers to search for CAT within')
    return
  }

  // Check that we're in an active transaction.
  segment = segment || this.getSegment()
  if (!segment || !segment.transaction.isActive()) {
    this.logger.trace('Not adding CAT reply header, not in an active transaction.')
    return
  }
  var tx = segment.transaction

  // Ensure this is a valid transport type.
  transportType = transportType || Transaction.TRANSPORT_TYPES.UNKNOWN
  if (!TRANSPORT_TYPES_SET[transportType]) {
    this.logger.debug('Unknown transport type: %j', transportType)
    transportType = Transaction.TRANSPORT_TYPES.UNKNOWN
  }

  if (this.agent.config.distributed_tracing.enabled) {
    const payload = headers[DISTRIBUTED_TRACE_HEADER]
    if (payload) {
      tx.acceptDistributedTracePayload(payload, transportType)
    }
    return
  }

  // Hunt down the CAT headers.
  var catId = null
  var transactionData = null
  var appData = null
  for (var key in headers) { // eslint-disable-line guard-for-in
    if (MATCH_CAT_ID_HEADER.test(key)) {
      catId = headers[key]
    } else if (MATCH_CAT_TRANSACTION_HEADER.test(key)) {
      transactionData = headers[key]
    } else if (MATCH_CAT_APP_DATA_HEADER.test(key)) {
      appData = headers[key]
    }
    if (catId && transactionData && appData) {
      break
    }
  }

  if (catId && transactionData) {
    cat.handleCatHeaders(catId, transactionData, this.agent.config.encoding_key, tx)
    if (tx.incomingCatId) {
      this.logger.trace(
        'Got inbound CAT headers in transaction %s from %s',
        tx.id,
        tx.incomingCatId
      )
    }
  }

  if (appData) {
    _handleCATReplyHeader(this, segment, appData)
    // TODO: Handle adding ExternalTransaction metrics for this segment.
  }
}

/**
 * Adds CAT headers for an outbound request.
 *
 * - `insertCATRequestHeaders(headers [, useAlternateHeaderNames])`
 *
 * @memberof TransactionShim.prototype
 *
 * @param {object} headers
 *  The outbound request headers object to inject our CAT headers into.
 *
 * @param {bool} [useAlternateHeaderNames=false]
 *  Indicates if HTTP-style headers should be used or alternate style. Some
 *  transport protocols are more strict on the characters allowed in headers
 *  and this option can be used to toggle use of pure-alpha header names.
 */
// TODO: abstract header logic shared with wrapRequest in http instrumentation
function insertCATRequestHeaders(headers, useAlternateHeaderNames) {
  // Is CAT enabled?
  if (!this.agent.config.cross_application_tracer.enabled) {
    this.logger.trace('CAT disabled, not adding headers.')
    return
  }
  var usingDistributedTracing = this.agent.config.distributed_tracing.enabled
  if (!this.agent.config.encoding_key && !usingDistributedTracing) {
    this.logger.warn('Missing encoding key, not adding CAT headers!')
    return
  } else if (!headers) {
    this.logger.debug('Missing headers object, not adding CAT headers!')
    return
  }

  // Make sure we're in a transaction right now.
  var tx = this.tracer.getTransaction()
  if (!tx || !tx.isActive()) {
    this.logger.trace('Not adding CAT reply header, not in an active transaction.')
    return
  }

  let txData = null
  let transHeader = null

  if (usingDistributedTracing) {
    transHeader = DISTRIBUTED_TRACE_HEADER
    txData = tx.createDistributedTracePayload().httpSafe()
  } else {
    // Determine the names of the headers we'll add.
    transHeader = HTTP_CAT_TRANSACTION_HEADER
    var idHeader = HTTP_CAT_ID_HEADER
    if (useAlternateHeaderNames) {
      idHeader = MQ_CAT_ID_HEADER
      transHeader = MQ_CAT_TRANSACTION_HEADER
    }

    // Add in the application ID.
    if (this.agent.config.obfuscatedId) {
      headers[idHeader] = this.agent.config.obfuscatedId
    }

    // Generate an application path hash. This is essentially a snapshot of what
    // the transaction would be named if it ended right now.
    var pathHash = hashes.calculatePathHash(
      this.agent.config.applications()[0],
      tx.getFullName(),
      tx.referringPathHash
    )
    tx.pushPathHash(pathHash)
    try {
      txData = hashes.obfuscateNameUsingKey(
        JSON.stringify([tx.id, false, tx.tripId || tx.id, pathHash]),
        this.agent.config.encoding_key
      )
    } catch (e) {
      this.logger.warn({error: e.stack}, 'Failed to serialize CAT header!')
    }
  }

  // Inject the transaction information header.
  if (txData) {
    headers[transHeader] = txData
    this.logger.trace('Added CAT headers to transaction %s', tx.id)
  }
}

/**
 * Adds CAT headers for an outbound response.
 *
 * - `insertCATReplyHeaders(headers [, useAlternateHeaderNames])`
 *
 * @memberof TransactionShim.prototype
 *
 * @param {object} headers
 *  The outbound response headers object to inject our CAT headers into.
 *
 * @param {bool} [useAlternateHeaderNames=false]
 *  Indicates if HTTP-style headers should be used or alternate style. Some
 *  transport protocols are more strict on the characters allowed in headers
 *  and this option can be used to toggle use of pure-alpha header names.
 */
function insertCATReplyHeader(headers, useAlternateHeaderNames) {
  // Is CAT enabled?
  var config = this.agent.config
  if (!config.cross_application_tracer.enabled) {
    this.logger.trace('CAT disabled, not adding reply header.')
    return
  } else if (config.distributed_tracing.enabled) {
    this.logger.warn('CAT disabled, distributed tracing is enabled')
    return
  } else if (!config.encoding_key) {
    this.logger.warn('Missing encoding key, not adding CAT reply header!')
    return
  } else if (!headers) {
    this.logger.debug('Missing headers object, not adding CAT reply header!')
    return
  }

  // Are we in a transaction?
  var segment = this.getSegment()
  if (!segment || !segment.transaction.isActive()) {
    this.logger.trace('Not adding CAT reply header, not in an active transaction.')
    return
  }
  var tx = segment.transaction

  // Hunt down the content length.
  // NOTE: In AMQP, content-type and content-encoding are guaranteed fields, but
  // there is no content-length field or header. For that, content length will
  // always be -1.
  var contentLength = -1
  for (var key in headers) {
    if (key.toLowerCase() === 'content-length') {
      contentLength = headers[key]
      break
    }
  }

  // Compose the obfuscated app data value.
  var appData = null
  var txName = tx.getFullName()
  try {
    appData = hashes.obfuscateNameUsingKey(JSON.stringify([
      config.cross_process_id,
      txName,
      tx.queueTime / 1000,
      tx.catResponseTime / 1000,
      contentLength,
      tx.id,
      false
    ]), config.encoding_key)
  } catch (e) {
    this.logger.warn({error: e.stack}, 'Failed to serialize CAT data for %s', txName)
  }

  // Add the header.
  headers[
    useAlternateHeaderNames ? MQ_CAT_APP_DATA_HEADER : HTTP_CAT_APP_DATA_HEADER
  ] = appData
  this.logger.trace('Added outbound response CAT headers for transaction %s', tx.id)
}

/**
 * Parses the given CAT response app-data and links the transaction to it.
 *
 * - `_handleCATReplyHeader(shim, segment, appData)`
 *
 * @private
 *
 * @param {TransactionShim} shim
 *  The shim to use in the process of extracting the app data.
 *
 * @param {!TraceSegment} segment
 *  The segment to attach the CAT data to.
 *
 * @param {string} appData
 *  The application data to parse and use.
 */
function _handleCATReplyHeader(shim, segment, appData) {
  // Attempt to parse the app data header.
  var config = shim.agent.config
  try {
    appData = JSON.parse(
      hashes.deobfuscateNameUsingKey(appData, config.encoding_key)
    )
  } catch (e) {
    shim.logger.warn('Unparsable CAT application data header: %s', appData)
    return
  }

  // Make sure the app data is of the expected format and that we trust the
  // origin application.
  if (!appData.length || !shim.isString(appData[0])) {
    shim.logger.trace('Unknown format for CAT application data header.')
    return
  }
  var accountId = parseInt(appData[0].split('#')[0], 10)
  var trustedIds = config.trusted_account_ids
  if (trustedIds && trustedIds.indexOf(accountId) === -1) {
    shim.logger.trace('CAT headers from untrusted application %s', accountId)
    return
  }

  // It's good! Pull out the data we care about.
  segment.catId = appData[0]
  segment.catTransaction = appData[1]
  if (appData.length >= 6) {
    segment.parameters.transaction_guid = appData[5]
  }
  shim.logger.trace(
    'Got inbound response CAT headers for transaction %s from %s',
    segment.transaction.id,
    appData[5]
  )
}

/**
 * Creates a function that binds transactions to the execution of the function.
 *
 * The created transaction may be nested within an existing transaction if
 * `spec.type` is not the same as the current transaction's type.
 *
 * @private
 *
 * @param {Shim} shim
 *  The shim used for the binding.
 *
 * @param {function} fn
 *  The function link with the transaction.
 *
 * @param {string} name
 *  The name of the wrapped function.
 *
 * @param {TransactionSpec} spec
 *  The spec for the transaction to create.
 *
 * @return {function} A function which wraps `fn` and creates potentially nested
 *  transactions linked to its execution.
 */
function _makeNestedTransWrapper(shim, fn, name, spec) {
  return function nestedTransactionWrapper() {
    // Reuse existing transactions only if the type matches.
    var transaction = shim.tracer.getTransaction()
    var segment = shim.tracer.segment

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
 *
 * @param {Shim} shim
 *  The shim used for the binding.
 *
 * @param {function} fn
 *  The function link with the transaction.
 *
 * @param {string} name
 *  The name of the wrapped function.
 *
 * @param {TransactionSpec} spec
 *  The spec for the transaction to create.
 *
 * @return {function} A function which wraps `fn` and potentially creates a new
 *  transaction linked to the function's execution.
 */
function _makeTransWrapper(shim, fn, name, spec) {
  return function transactionWrapper() {
    // Don't nest transactions, reuse existing ones!
    if (shim.tracer.getTransaction()) {
      return fn.apply(this, arguments)
    }

    shim.logger.trace('Creating new %s transaction for %s', spec.type, name)
    var transaction = new Transaction(shim.agent)
    transaction.type = spec.type
    return shim.applySegment(fn, transaction.trace.root, false, this, arguments)
  }
}
