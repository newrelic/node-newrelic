/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const newrelic = require('newrelic')
const semver = require('semver')
const agentVersion = newrelic && newrelic.agent && newrelic.agent.version

const instrumentations = [
  {
    type: 'conglomerate',
    moduleName: 'aws-sdk',
    onRequire: require('./lib/v2/instrumentation')
  }
]

// TODO: Remove this semver check and semver module when we ship Node 18 support
// A bug existed in 8.6.0 when we introduced the `onResolved` hook.
// See: https://github.com/newrelic/node-newrelic/pull/986
// To avoid unnecessary support issues we will require agent version >= 8.7.0 to
// register AWS SDK v3 instrumentation
if (semver.satisfies(agentVersion, '>=8.7.0')) {
  instrumentations.push(
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
  )
} else {
  newrelic.shim.logger.warn(
    'The New Relic Node.js agent must be >= 8.7.0 to instrument AWS SDK v3, current version: %s',
    agentVersion
  )
}

module.exports = instrumentations
