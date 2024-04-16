/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = [
  {
    type: 'web-framework',
    moduleName: 'koa',
    shimName: 'koa',
    onRequire: require('./lib/instrumentation')
  },
  {
    type: 'web-framework',
    moduleName: 'koa-router',
    shimName: 'koa',
    onRequire: require('./lib/router-instrumentation')
  },
  {
    type: 'web-framework',
    moduleName: '@koa/router',
    shimName: 'koa',
    onRequire: require('./lib/router-instrumentation')
  },
  {
    type: 'web-framework',
    moduleName: 'koa-route',
    shimName: 'koa',
    onRequire: require('./lib/route-instrumentation')
  }
]
