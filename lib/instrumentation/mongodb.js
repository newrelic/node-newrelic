/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')
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
 * @param {Agent} agent instance
 * @param {object} mongodb resolved package
 * @param {string} moduleName name of module
 * @param {Shim} shim instance
 */
function initialize(agent, mongodb, moduleName, shim) {
  if (!mongodb) {
    return
  }

  const mongoVersion = shim.pkgVersion
  if (semver.satisfies(mongoVersion, '<4.0.0')) {
    shim.logger.warn(
      'New Relic Node.js agent no longer supports mongodb < 4, current version %s. Please downgrade to v11 for support, if needed',
      mongoVersion
    )
    return
  }

  shim.setDatastore(shim.MONGODB)
  instrumentV4(shim, mongodb)
}
