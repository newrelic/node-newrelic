/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * The path changes depending on the version...
 * so we don't want to hard-code the relative
 * path from the module root.
 * @param {Object} shim The New Relic agent shim.
 * @param {String} resolvedName The name of the sought module.
 * @param {String} exportName The name of the sought module property.
 * @returns {Object} The sought module property.
 */
exports.getExport = function getExport(shim, resolvedName, exportName) {
  const fileNameIndex = resolvedName.indexOf('/index')
  const relativeFolder = resolvedName.substr(0, fileNameIndex)
  return shim.require(`${relativeFolder}/${exportName}`)
}

/**
 * Given a plugin getter, calls the instances middlewareStack.use to register
 * a plugin that adds a middleware to record operations.
 * see: https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/
 *
 * @param {function} getPlugin Plugin getter, produces middleware given params.
 * @returns {function}
 */
exports.wrapPostClientConstructor = function wrapPostClientConstructor(getPlugin) {
  return function wrapShim(shim) {
    this.middlewareStack.use(getPlugin(shim, this.config))
  }
}

/**
 * Wrap a client constructor with a post-construction handler,
 * attaching it to an instance and shim.
 * @param {function} postClientConstructor Handler run after client instantiation.
 * @returns {function}
 */
exports.wrapReturn = function wrapReturn(postClientConstructor) {
  /**
   * Handler passed to `shim.wrapReturn` to instrument a client.
   * @param {Object} shim The New Relic agent shim.
   * @param {function} fn The calling function.
   * @param {String} fnName The calling function's name.
   * @param {Object} instance The client instance.
   * @returns {function}
   */
  return function wrappedReturn(shim, fn, fnName, instance) {
    postClientConstructor.call(instance, shim)
  }
}
