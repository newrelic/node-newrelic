/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const instrumentedLibraries = require('./lib/instrumentations')() || {}
const libNames = Object.keys(instrumentedLibraries)
module.exports = function loadExternals(config) {
  if (config.target.includes('node')) {
    config.externals.push(...libNames)
  }

  return config
}
