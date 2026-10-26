/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Module = require('node:module')
const pkgJSON = require('../../package.json')

// The OpenTelemetry bridge requires the agent's `@opentelemetry/*`
// dependencies to be installed. The list is derived from the agent's
// dependencies so it stays in step with what the bridge actually needs.
const otelPackages = Object.keys(pkgJSON.dependencies).filter((dep) => dep.startsWith('@opentelemetry'))

/**
 * Determines whether every `@opentelemetry/*` bridge package can be resolved
 * from a given location, using the same resolution Node.js performs for a
 * `require` at that location.
 *
 * @param {string} fromPath A path or `file:` URL to anchor resolution at. The
 * agent anchors this at its own install location; the `validate-config` CLI
 * anchors it at the configuration file being validated.
 *
 * @returns {boolean} True when all bridge packages resolve, false if any is
 * missing.
 */
function isOtelBridgeAvailable(fromPath) {
  const require = Module.createRequire(fromPath)
  for (const otelPackage of otelPackages) {
    try {
      require.resolve(otelPackage)
    } catch (error) {
      if (error.code.includes('MODULE_NOT_FOUND') === true) {
        return false
      }
    }
  }
  return true
}

module.exports = { isOtelBridgeAvailable, otelPackages }
