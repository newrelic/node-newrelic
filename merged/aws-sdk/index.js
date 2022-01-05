/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Allows users to `require('@newrelic/aws-sdk')` directly in their app. If they
 * for some reason choose to explicitly use an older version of our instrumentation
 * then the supportability metrics for custom instrumentation will trigger.
 */
const newrelic = require('newrelic')
const semver = require('semver')
const agentVersion = newrelic && newrelic.agent && newrelic.agent.version
newrelic.instrumentConglomerate('aws-sdk', require('./lib/v2/instrumentation'))

// TODO: Remove this semver check and semver module when we ship Node 18 support
// A bug existed in 8.6.0 when we introduced the `onResolved` hook.
// See: https://github.com/newrelic/node-newrelic/pull/986
// To avoid unnecessary support issues we will require agent version >= 8.7.0 to
// register AWS SDK v3 instrumentation
if (!semver.satisfies(agentVersion, '>=8.7.0')) {
  newrelic.shim.logger.warn(
    'The New Relic Node.js agent must be >= 8.7.0 to instrument AWS SDK v3, current version: %s',
    agentVersion
  )
  return
}

newrelic.instrument({
  moduleName: '@aws-sdk/smithy-client',
  onResolved: require('./lib/v3/smithy-client')
})
newrelic.instrumentMessages({
  moduleName: '@aws-sdk/client-sns',
  onResolved: require('./lib/v3/sns')
})
newrelic.instrumentMessages({
  moduleName: '@aws-sdk/client-sqs',
  onResolved: require('./lib/v3/sqs')
})
newrelic.instrumentDatastore({
  moduleName: '@aws-sdk/client-dynamodb',
  onResolved: require('./lib/v3/client-dynamodb')
})
newrelic.instrumentDatastore({
  moduleName: '@aws-sdk/lib-dynamodb',
  onResolved: require('./lib/v3/lib-dynamodb')
})
