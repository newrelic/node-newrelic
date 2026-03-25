/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const instrumentedLibraries = require('./lib/instrumentations')() || {}
const libNames = Object.keys(instrumentedLibraries)
const subscriptions = require('./lib/subscriber-configs')
const subscribers = Object.keys(subscriptions)
const packages = [...libNames, ...subscribers]

/**
 * This is to be used with bundlers. It will add all of our instrumented 3rd party modules
 * into the `externals` array.
 *
 * **Note** Only tested with `webpack`, [see](https://webpack.js.org/configuration/externals/)
 *
 * @param {object} config bundler config
 */
module.exports = function loadExternals(config) {
  if (config.target.includes('node')) {
    config.externals.push(...packages)
  }

  return config
}
