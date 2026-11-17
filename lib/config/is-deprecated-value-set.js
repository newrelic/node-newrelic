/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = isDeprecatedValueSet

const deriveEnvVarName = require('./derive-env-var-name.js')
const getByPath = require('#agentlib/util/get.js')

/**
 * Determines if a deprecated configuration value is being specified by the
 * user via their provided configuration object and environment variables.
 *
 * @param {object} params Function parameters
 * @param {object} params.userConfig The configuration object supplied by
 * the user, i.e. what was read from a file on disk.
 * @param {string[]} params.oldPath Path to the old configuration value.
 * @param {string} [params.oldEnvVar] Name of the environment variable that
 * maps to the old setting. This is only needed if the provided path does not
 * translate into the name, e.g. `['foo', 'bar', 'baz']` is set by env var
 * `FOO_BAR_BAZ_ENABLED` instead of `FOO_BAR_BAZ`.
 *
 * @returns {boolean} True if the deprecated value has been set explicitly.
 */
function isDeprecatedValueSet({ userConfig, oldPath, oldEnvVar }) {
  const oldEnv = oldEnvVar ?? deriveEnvVarName(oldPath.at(-1), oldPath.slice(0, -1))
  if (process.env[oldEnv] !== undefined) return true

  const oldVal = getByPath(userConfig, oldPath)
  return oldVal != null
}
