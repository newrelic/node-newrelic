/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { boolean } = require('./formatters')
const instrumentedLibraries = require('../instrumentations')()
const pkgNames = Object.keys(instrumentedLibraries)
const coreLibraries = require('../core-instrumentation')
const corePkgs = Object.keys(coreLibraries)
const subscriptions = require('../subscriber-configs')
const subscribers = Object.keys(subscriptions)
pkgNames.push(...subscribers)
// Manually adding domain as it is registered separately in shimmer
corePkgs.push('domain')
pkgNames.push(...corePkgs)

// Packages are normally enabled without any extra
// configuration. This list is a set of packages that
// we want to be disabled without any extra configuration.
// Typically, this is because the instrumentation no longer
// provides useful data. Users can still enable them if they
// are interested in the instrumentation they provide.
const disabledPkgs = ['timers']

/**
 * Builds the stanza for config.instrumentation.*
 * It defaults every library to true and assigns a boolean
 * formatter for the environment variable conversion of the values
 */
module.exports = pkgNames.reduce((config, pkg) => {
  let defaultValue = true
  if (disabledPkgs.includes(pkg)) {
    defaultValue = false
  }
  config[pkg] = { enabled: { formatter: boolean, default: defaultValue } }
  return config
}, {})
