/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('path')
const logger = require('./logger')
const NAMES = require('./metrics/names')
const properties = require('./util/properties')
const shimmer = require('./shimmer')

// Static variable holding map of un-instrumented modules for use in the future
const uninstrumented = Object.create(null)

// Log a helpful message about un-instrumented modules
function logUninstrumented() {
  const modules = Object.keys(uninstrumented)
  if (modules.length > 0) {
    let message =
      'The newrelic module must be the first module required.\n' +
      'The following modules were required before newrelic and are not being ' +
      'instrumented:'

    modules.forEach(function buildMessage(module) {
      message += '\n\t' + uninstrumented[module].name + ': ' + uninstrumented[module].filename
    })

    logger.warn(message)
  }
}

// Create Supportability/Uninstrumented/<module> metrics
//
// @param metrics Agent metrics aggregator
function createMetrics(metrics) {
  const modules = Object.keys(uninstrumented)
  if (modules.length > 0) {
    metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.UNINSTRUMENTED).incrementCallCount()
  }

  modules.forEach(function addMetrics(module) {
    metrics
      .getOrCreateMetric(NAMES.SUPPORTABILITY.UNINSTRUMENTED + '/' + uninstrumented[module].name)
      .incrementCallCount()
  })
}

// Check for any instrument-able modules that have already been loaded. This does
// not check core modules as we don't have access to the core module loader
// cache. But, users probably are missing instrumentation for other modules if
// they are missing instrumentation for core modules.
function check() {
  const instrumentations = Object.keys(shimmer.registeredInstrumentations)
  // Special case since we do some hackish stuff in lib/shimmer.js to make pg.js,
  // and mysql2 work.
  instrumentations.push('pg.js', 'mysql2')

  for (const filename in require.cache) {
    if (!properties.hasOwn(require.cache, filename)) {
      continue
    }

    // only interested in whatever follows the last occurrence of node_modules
    const paths = filename.split('node_modules' + path.sep)
    const modulePath = paths[paths.length - 1]

    for (let i = 0; i < instrumentations.length; i++) {
      const name = instrumentations[i]
      if (modulePath.startsWith(name) && !uninstrumented[name]) {
        uninstrumented[name] = { name, filename }
      }
    }
  }

  logUninstrumented()
}

module.exports = { check, createMetrics }
