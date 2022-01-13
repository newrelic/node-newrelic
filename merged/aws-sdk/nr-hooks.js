/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const instrumentations = [
  {
    type: 'conglomerate',
    moduleName: 'aws-sdk',
    onRequire: require('./lib/v2/instrumentation')
  },
  {
    type: 'generic',
    moduleName: '@aws-sdk/smithy-client',
    onResolved: require('./lib/v3/smithy-client')
  },
  {
    type: 'message',
    moduleName: '@aws-sdk/client-sns',
    onResolved: require('./lib/v3/sns')
  },
  {
    type: 'message',
    moduleName: '@aws-sdk/client-sqs',
    onResolved: require('./lib/v3/sqs')
  },
  {
    type: 'datastore',
    moduleName: '@aws-sdk/client-dynamodb',
    onResolved: require('./lib/v3/client-dynamodb')
  },
  {
    type: 'datastore',
    moduleName: '@aws-sdk/lib-dynamodb',
    onResolved: require('./lib/v3/lib-dynamodb')
  }
]

// TODO: Remove code block next major release of module by moving to a peer-dependency check.
// See further comments in check-agent-compatible.js.
const checkAgentCompatible = require('./lib/v3/check-agent-compatible')
const NOOP_ON_REQUIRE = () => false

instrumentations
  .filter((definition) => {
    return definition.onResolved
  })
  .forEach(addCompatibleAgentCheck)

/**
 * Adds a check on resolve to ensure on a version of the agent that does
 * not have the multiple invocation bug. If compatible, replaces onResolved
 * with original and returns value of invoked original. If not compatible,
 * sets onResolved to null so the related instrumentation gets skipped on each
 * resolve.
 * @param {object} definition Object definition instrumentation parameters
 */
function addCompatibleAgentCheck(definition) {
  // Silence old agent versions from warning about missing require.
  definition.onRequire = NOOP_ON_REQUIRE

  const originalOnResolved = definition.onResolved

  definition.onResolved = function checkCompatibleOnResolved(shim, name) {
    if (!checkAgentCompatible(shim.agent.config.version, shim.logger, name)) {
      // Prevent future attempted execution which avoids allocating a shim each time.
      definition.onResolved = null
      return false
    }

    definition.onResolved = originalOnResolved
    return originalOnResolved.apply(this, arguments)
  }
}

// ------------------------------------------------------------------

module.exports = instrumentations
