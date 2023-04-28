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
newrelic.instrumentConglomerate('aws-sdk', require('./lib/v2/instrumentation'))

newrelic.instrument({
  moduleName: '@aws-sdk/smithy-client',
  onResolved: require('./lib/v3/smithy-client'),
  shimName: 'aws-sdk'
})
newrelic.instrumentMessages({
  moduleName: '@aws-sdk/client-sns',
  onResolved: require('./lib/v3/sns'),
  shimName: 'aws-sdk'
})
newrelic.instrumentMessages({
  moduleName: '@aws-sdk/client-sqs',
  onResolved: require('./lib/v3/sqs'),
  shimName: 'aws-sdk'
})
newrelic.instrumentDatastore({
  moduleName: '@aws-sdk/client-dynamodb',
  onResolved: require('./lib/v3/client-dynamodb'),
  shimName: 'aws-sdk'
})
newrelic.instrumentDatastore({
  moduleName: '@aws-sdk/lib-dynamodb',
  onResolved: require('./lib/v3/lib-dynamodb'),
  shimName: 'aws-sdk'
})
