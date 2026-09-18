/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = deriveEnvVarName

/**
 * Constructs a string representing an environment variable name from the
 * provided key and object path parts.
 *
 * @example
 * const config = { foo: { bar: { baz: 42 } } }
 * const name = deriveEnvVarName('baz', ['foo', 'bar'])
 * // name => 'NEW_RELIC_FOO_BAR_BAZ'
 *
 * @param {string} key The key name that is the innermost key of the path.
 * @param {string[]} paths The list of leaf node key names leading to the
 * config key.
 *
 * @returns {string} Formatted env var name.
 */
function deriveEnvVarName(key, paths) {
  let configPath = paths.join('_')
  configPath = configPath ? `${configPath}_` : configPath
  return `NEW_RELIC_${configPath.toUpperCase()}${key.toUpperCase()}`
}
