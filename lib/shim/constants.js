/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Enumeration of module instrumentation types.
 *
 * @private
 * @readonly
 * @enum {string}
 */
exports.MODULE_TYPE = {
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
  WEB_FRAMEWORK: 'web-framework',

  /**
   * Used to load supportability metrics on installed verisions of packages
   * that the Node.js agent does not instrument(i.e. - otel instrumentation or top logging libraries)
   */
  TRACKING: 'tracking'
}
