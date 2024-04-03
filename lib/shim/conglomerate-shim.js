/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'ConglomerateShim' })
const Shim = require('./shim')

const InstrumentationDescriptor = require('../instrumentation-descriptor')
const SHIM_CLASSES = {
  [InstrumentationDescriptor.TYPE_GENERIC]: Shim,
  [InstrumentationDescriptor.TYPE_DATASTORE]: require('./datastore-shim'),
  [InstrumentationDescriptor.TYPE_MESSAGE]: require('./message-shim'),
  [InstrumentationDescriptor.TYPE_PROMISE]: require('./promise-shim'),
  [InstrumentationDescriptor.TYPE_TRANSACTION]: require('./transaction-shim'),
  [InstrumentationDescriptor.TYPE_WEB_FRAMEWORK]: require('./webframework-shim')
}

/**
 * A shim for wrapping all-in-one modules which implement multiple services.
 *
 * @private
 * @augments Shim
 * @param {Agent} agent The agent this shim will use.
 * @param {string} moduleName The name of the module being instrumented.
 * @param {string} resolvedName The full path to the loaded module.
 * @param {string} shimName Used to persist shim ids across different shim instances.
 * @param {string} pkgVersion version of module
 */
class ConglomerateShim extends Shim {
  constructor(agent, moduleName, resolvedName, shimName, pkgVersion) {
    super(agent, moduleName, resolvedName, shimName, pkgVersion)
    this._logger = logger.child({ module: moduleName })
    this._resolvedName = resolvedName
  }

  get GENERIC() {
    return InstrumentationDescriptor.TYPE_GENERIC
  }
  get DATASTORE() {
    return InstrumentationDescriptor.TYPE_DATASTORE
  }
  get MESSAGE() {
    return InstrumentationDescriptor.TYPE_MESSAGE
  }
  get PROMISE() {
    return InstrumentationDescriptor.TYPE_PROMISE
  }
  get TRANSACTION() {
    return InstrumentationDescriptor.TYPE_TRANSACTION
  }
  get WEB_FRAMEWORK() {
    return InstrumentationDescriptor.TYPE_WEB_FRAMEWORK
  }

  /**
   * Constructs a new `Shim` of the specified type for instrumenting submodules
   * of the conglomerate module.
   *
   * @param {string} type  - The type of shim to construct. Utilize the static
   * type fields on {@link InstrumentationDescriptor}.
   * @param {string} submodule  - The name of the submodule this will instrument.
   * @returns {Shim} A new shim of the given type.
   */
  makeSpecializedShim(type, submodule) {
    const ShimClass = SHIM_CLASSES[type]
    const shim = new ShimClass(
      this.agent,
      this.moduleName,
      this._resolvedName,
      null,
      this.pkgVersion
    )
    // associate the parent shim.id with the new submodule
    shim.id = this.id
    shim._logger = shim._logger.child({ submodule })
    return shim
  }
}

module.exports = ConglomerateShim
