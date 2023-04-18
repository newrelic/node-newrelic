/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')

module.exports = function initialize(agent, vision, moduleName, shim) {
  const plugin = vision.plugin

  if (!plugin || !plugin.pkg || semver.lt(plugin.pkg.version, '5.0.0')) {
    shim.logger.debug('Vision instrumentation requires v5 or greater, not instrumenting')
    return false
  }

  // Vision is only meant to be used with hapi
  shim.setFramework(shim.HAPI)

  shim.wrap(plugin, 'register', function wrapRegister(shim, register) {
    return function wrappedRegister(server) {
      if (!shim.isWrapped(server, 'decorate')) {
        shim.wrap(server, 'decorate', wrapDecorate)
      }

      return register.apply(this, arguments)
    }
  })
}

function wrapDecorate(shim, decorate) {
  return function wrappedDecorate(type, name, handler) {
    if (type !== 'toolkit' || name !== 'view') {
      return decorate.apply(this, arguments)
    }

    const args = shim.argsToArray.apply(shim, arguments)
    args[2] = shim.recordRender(handler, { promise: true })

    return decorate.apply(this, args)
  }
}
