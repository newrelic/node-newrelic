/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Allows users to `require('@newrelic/koa')` directly in their app. If they
 * for some reason choose to explicitly use an older version of our instrumentation
 * then the supportability metrics for custom instrumentation will trigger.
 */
const newrelic = require('newrelic')
newrelic.instrumentWebframework({
  moduleName: 'koa',
  onRequire: require('./lib/instrumentation'),
  shimName: 'koa'
})
newrelic.instrumentWebframework({
  moduleName: 'koa-route',
  onRequire: require('./lib/route-instrumentation'),
  shimName: 'koa'
})
newrelic.instrumentWebframework({
  moduleName: 'koa-router',
  onRequire: require('./lib/router-instrumentation'),
  shimName: 'koa'
})
