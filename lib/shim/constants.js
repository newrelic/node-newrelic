'use strict'

/**
 * Enumeration of module instrumentation types.
 *
 * @private
 * @readonly
 * @enum {string}
 */
var MODULE_TYPE = {
  /** Utility/generic module, such as pooling libraries. */
  GENERIC: 'generic',

  /** Database module, such as the MongoDB or MySQL drivers. */
  DATASTORE: 'datastore',

  /** Messaging module, such as AMQP */
  MESSAGE: 'message',

  /** Web server framework module, such as Express or Restify. */
  WEB_FRAMEWORK: 'web-framework'
}


exports.MODULE_TYPE = MODULE_TYPE
