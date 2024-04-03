/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const IdGen = require('./util/idgen')
const idGen = new IdGen()

/**
 * @typedef {function} InstrumentationOnRequire
 * @param {Shim} shim The shim instance to use for the instrumentation.
 * @param {object} resolvedNodule The module being instrumented as returned by
 * Node's `require` function.
 * @param {string} moduleName The simple name of the module, i.e. the value
 * passed to the `require` function.
 * @throws {Error|object}
 */

/**
 * @typedef {function} InstrumentationOnError
 * @param {Error|object} error The error thrown by `onRequire` when there was
 * an issue registering the instrumentation.
 */

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} InstrumentationDescriptorParams
 * @property {string} absolutePath
 * @property {string} module
 * @property {string} moduleName
 * @property {string} shimName
 * @property {InstrumentationOnError} onError
 * @property {InstrumentationOnRequire} onRequire
 * @property {string} resolvedName
 * @property {string} type
 */

/**
 * Describes the configuration for an instrumentation. An instrumentation
 * is what `newrelic` uses to wrap Node.js modules. In particular, a description
 * details the name of the module, the path on disk to the module, and the
 * hooks (`onRequire` and `onError`) to apply to the module.
 */
class InstrumentationDescriptor {
  /**
   * Utility/generic module.
   * @type {string}
   */
  static TYPE_GENERIC = 'generic'

  /**
   * @private
   * @type {string}
   */
  static TYPE_CONGLOMERATE = 'conglomerate'

  /**
   * Database module, such as the MongoDB or MySQL drivers.
   * @type {string}
   */
  static TYPE_DATASTORE = 'datastore'

  /**
   * Messaging module, such as AMQP.
   * @type {string}
   */
  static TYPE_MESSAGE = 'message'

  /**
   * Promise module, such as Bluebird.
   * @type {string}
   */
  static TYPE_PROMISE = 'promise'

  /**
   * @private
   * @type {string}
   */
  static TYPE_TRANSACTION = 'transaction'

  /**
   * Web server framework module, such as Express or Fastify.
   * @type {string}
   */
  static TYPE_WEB_FRAMEWORK = 'web-framework'

  /**
   * Used to load supportability metrics on installed versions of packages
   * that the Node.js agent does not instrument (e.g. OTEL instrumentation or
   * top logging libraries).
   * @type {string}
   */
  static TYPE_TRACKING = 'tracking'

  /**
   * The type of the module being instrumented. See the static `TYPE_` fields.
   * @type {string|null}
   */
  type

  /**
   * The name of the module being instrumented, i.e. the string used to require
   * the module. This must map to a directory in `lib/instrumentations` which
   * contains an `nr-hooks.js` file.
   *
   * This takes precedence over `moduleName`.
   * @type {string}
   */
  module

  /**
   * The name of the module being instrumented, i.e. the string used to require
   * the module. This must map to a JavaScript file of the same name in the
   * `lib/instrumentations` directory.
   * @type {string}
   */
  moduleName

  /**
   * Used when instrumenting a module to determine if a module has already
   * been wrapped by a specific shim instance. It is used in conjunction with
   * the `shim.id` value.
   * @type {string}
   */
  shimName

  /**
   * The absolute path to the module to instrument. This should only be set
   * when the module being instrumented does not reside in a `node_modules`
   * directory; for example, when someone is instrumenting a module of their
   * own through the public API.
   *
   * The `moduleName` property still needs to be set to the simple name, i.e.
   * the string passed to `require`, for instrumentation tracking purposes.
   *
   * Note: this value takes precedence over `moduleName`.
   */
  absolutePath

  /**
   * The fully resolved path to the module, e.g. `/opt/app/node_modules/foo`.
   * If the module is a core module, the special value `.` should be used.
   * @type {string}
   */
  resolvedName

  /**
   * Hook to invoke when the module is required. This is the actual
   * implementation of the instrumentation.
   * @type {InstrumentationOnRequire}
   */
  onRequire

  /**
   * Hook to invoke when the `onRequire` hook throws an error.
   * @type {InstrumentationOnError}
   */
  onError

  /**
   * @type {number}
   */
  #id

  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {InstrumentationDescriptorParams} params
   */
  constructor(params) {
    this.absolutePath = params.absolutePath
    this.module = params.module
    this.moduleName = params.moduleName
    this.shimName = params.shimName
    this.onError = params.onError
    this.onRequire = params.onRequire
    this.resolvedName = params.resolvedName
    this.type = params.type

    this.#id = idGen.idFor(this.moduleName)
  }

  /**
   * Identifier for the instrumentation. Used by the internal instrumentation
   * tracker to distinguish between different instrumentations targeting the
   * same module.
   *
   * @returns {number} The identifier.
   */
  get instrumentationId() {
    return this.#id
  }
}

module.exports = InstrumentationDescriptor

// This export is for backward compatibility in the public API. The
// public API object simply re-exports this object that was originally
// in a `constants.js` file prior to the creation of the
// `InstrumentationDescriptor`.
module.exports.TYPES = {
  GENERIC: InstrumentationDescriptor.TYPE_GENERIC,

  DATASTORE: InstrumentationDescriptor.TYPE_DATASTORE,
  MESSAGE: InstrumentationDescriptor.TYPE_MESSAGE,
  PROMISE: InstrumentationDescriptor.TYPE_PROMISE,

  WEB_FRAMEWORK: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
  TRACKING: InstrumentationDescriptor.TYPE_TRACKING,
  /** @private */
  CONGLOMERATE: InstrumentationDescriptor.TYPE_CONGLOMERATE,
  /** @private */
  TRANSACTION: InstrumentationDescriptor.TYPE_TRANSACTION
}
