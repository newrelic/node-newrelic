/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')
const instrument = require('./mongodb/v2-mongo')
const instrumentV3 = require('./mongodb/v3-mongo')
const instrumentV4 = require('./mongodb/v4-mongo')

// XXX: When this instrumentation is modularized, update this thread
// with a cautionary note:
// https://discuss.newrelic.com/t/feature-idea-using-mongoose-cursors-memory-leaking-very-quickly/49270/14
//
// This instrumentation is deep linked against in the mongoose instrumentation
// snippet.  The snippet will break once this file is moved from this
// location.

module.exports = initialize

/**
 * Registers the query parser, and relevant instrumentation
 * based on version of mongodb
 *
 * @param {Agent} agent
 * @param {object} mongodb resolved package
 * @param {string} moduleName name of module
 * @param {Shim} shim
 */
function initialize(agent, mongodb, moduleName, shim) {
  if (!mongodb) {
    return
  }

  shim.setDatastore(shim.MONGODB)

  const mongoVersion = shim.pkgVersion
  if (semver.satisfies(mongoVersion, '>=4.0.0')) {
    instrumentV4(shim, mongodb)
  } else if (semver.satisfies(mongoVersion, '>=3.0.6')) {
    instrumentV3(shim, mongodb)
  } else {
    instrument(shim, mongodb)
  }
}
