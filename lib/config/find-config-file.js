/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = findConfigFile
module.exports.utils = {
  getConfigFileLocations,
  getConfigFileNames
}

const path = require('node:path')
const fs = require('node:fs')

/**
 * Get a filtered list of available configuration file paths. The order will
 * be from the highest priority to lowest. Paths that are not present in the
 * environment will be omitted.
 *
 * @returns {string[]} Set of paths to search.
 */
function getConfigFileLocations() {
  // We explicitly use a function invocation time built array so that
  // the processing of environment variables happens at invocation time
  // instead of at module load time (as they would be cached once).
  return [
    process.env.NEW_RELIC_HOME,
    process.cwd(),
    process.env.HOME,
    // The directory containing `node_modules`:
    path.join(__dirname, '../../../..'),
    // The REPL has no main module:
    process.mainModule && process.mainModule.filename
      ? path.dirname(process.mainModule.filename)
      : undefined
  ].filter(Boolean)
}

/**
 * Get a filtered list of available configuration file names. The order will
 * be from the highest priority to lowest.
 *
 * @returns {string[]} The list of possible configuration file names.
 */
function getConfigFileNames() {
  // We explicitly use a function invocation time built array so that
  // the processing of environment variables happens at invocation time
  // instead of at module load time (as they would be cached once).
  return [
    process.env.NEW_RELIC_CONFIG_FILENAME,
    'newrelic.js',
    'newrelic.cjs',
    'newrelic.mjs'
  ].filter(Boolean)
}

/**
 * Builds a set of absolute paths to potential agent configuration file
 * locations and filters to the first available file.
 *
 * @returns {string|undefined} The absolute path to the first matched
 * configuration file that exists, or `undefined`.
 */
function findConfigFile() {
  const availableLocations = getConfigFileLocations()
  const availableNames = getConfigFileNames()

  const candidates = []
  for (const dir of availableLocations) {
    for (const name of availableNames) {
      candidates.push(
        path.join(path.resolve(dir), name)
      )
    }
  }

  return candidates.find(fs.existsSync)
}
