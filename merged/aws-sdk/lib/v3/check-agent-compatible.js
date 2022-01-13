/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')

const ON_REQUIRE_COMPATIBLE_VERSIONS = '>=8.7.0'

// TODO: Remove this semver check and semver module when we ship Node 18 support
// A bug existed in 8.6.0 when we introduced the `onResolved` hook.
// See: https://github.com/newrelic/node-newrelic/pull/986
// To avoid unnecessary support issues we will require agent version >= 8.7.0 to
// register AWS SDK v3 instrumentation
function checkAgentCompatible(agentVersion, logger, moduleName) {
  const isCompatible = semver.satisfies(agentVersion, ON_REQUIRE_COMPATIBLE_VERSIONS)

  if (!isCompatible) {
    logger.warn(
      `Agent version must be ${ON_REQUIRE_COMPATIBLE_VERSIONS} to instrument ${moduleName}. ` +
        `Current version: ${agentVersion}`
    )
  }

  return isCompatible
}

module.exports = checkAgentCompatible
