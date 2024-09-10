/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { boolean } = require('./formatters')
const instrumentedLibraries = require('../instrumentations')()
const pkgNames = Object.keys(instrumentedLibraries)

/**
 * Builds the stanza for config.instrumentation.*
 * It defaults every library to true and assigns a boolean
 * formatter for the environment variable conversion of the values
 */
module.exports = pkgNames.reduce((config, pkg) => {
  config[pkg] = { enabled: { formatter: boolean, default: true } }
  return config
}, {})
