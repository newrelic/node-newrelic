/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'ConglomerateShim' })
const Shim = require('./shim')

const { MODULE_TYPE } = require('./constants')
const SHIM_CLASSES = {
  [MODULE_TYPE.GENERIC]: Shim,
  [MODULE_TYPE.DATASTORE]: require('./datastore-shim'),
  [MODULE_TYPE.MESSAGE]: require('./message-shim'),
  [MODULE_TYPE.PROMISE]: require('./promise-shim'),
  [MODULE_TYPE.TRANSACTION]: require('./transaction-shim'),
  [MODULE_TYPE.WEB_FRAMEWORK]: require('./webframework-shim')
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
    return MODULE_TYPE.GENERIC
  }
  get DATASTORE() {
    return MODULE_TYPE.DATASTORE
  }
  get MESSAGE() {
    return MODULE_TYPE.MESSAGE
  }
  get PROMISE() {
    return MODULE_TYPE.PROMISE
  }
  get TRANSACTION() {
    return MODULE_TYPE.TRANSACTION
  }
  get WEB_FRAMEWORK() {
    return MODULE_TYPE.WEB_FRAMEWORK
  }

  /**
   * Constructs a new `Shim` of the specified type for instrumenting submodules
   * of the conglomerate module.
   *
   * @param {MODULE_TYPE} type  - The type of shim to construct.
   * @param {string} submodule  - The name of the submodule this will instrument.
   * @returns {Shim} A new shim of the given type.
   */
  makeSpecializedShim(type, submodule) {
    const ShimClass = SHIM_CLASSES[type]
    const shim = new ShimClass(this.agent, this.moduleName, this._resolvedName)
    shim._logger = shim._logger.child({ submodule })
    return shim
  }
}

module.exports = ConglomerateShim
