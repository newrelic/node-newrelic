/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// The path changes depending on the version...
// so we don't want to hard-code the relative
// path from the module root.
exports.getExport = function getExport(shim, resolvedName, exportName) {
  const fileNameIndex = resolvedName.indexOf('/index')
  const relativeFolder = resolvedName.substr(0, fileNameIndex)
  return shim.require(`${relativeFolder}/${exportName}`)
}

/**
 * Given a plugin getter, calls the instances middlewareStack.use to register
 * a plugin that adds a middleware to record the dynamo operations.
 * see: https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/
 *
 * @param {function} getPlugin
 */
exports.wrapPostClientConstructor = function wrapPostClientConstructor(getPlugin) {
  return function wrapShim(shim) {
    this.middlewareStack.use(getPlugin(shim, this.config))
  }
}
