'use strict'

/**
 * Enumeration of module instrumentation types.
 *
 * @private
 * @readonly
 * @enum {string}
 */
const MODULE_TYPE = {
  /** Utility/generic module, such as pooling libraries. */
  GENERIC: 'generic',

  /** @private */
  CONGLOMERATE: 'conglomerate',

  /** Database module, such as the MongoDB or MySQL drivers. */
  DATASTORE: 'datastore',

  /** Messaging module, such as AMQP */
  MESSAGE: 'message',

  /** Promise module, such as Bluebird */
  PROMISE: 'promise',

  /** @private */
  TRANSACTION: 'transaction',

  /** Web server framework module, such as Express or Restify. */
  WEB_FRAMEWORK: 'web-framework'
}

/**
 * Enumeration of symbols used by shims.
 *
 * @memberof Shim.prototype
 * @readonly
 * @enum {Symbol}
 */
const SYMBOLS = {
  /** Indicates distributed tracing should be disabled for a single request. */
  DISABLE_DT: Symbol('Disable distributed tracing')
}

exports.MODULE_TYPE = MODULE_TYPE
exports.SYMBOLS = SYMBOLS
