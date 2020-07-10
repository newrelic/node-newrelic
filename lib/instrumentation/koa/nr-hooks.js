/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = [{
  type: 'web-framework',
  moduleName: 'koa',
  onRequire: require('./lib/instrumentation')
}, {
  type: 'web-framework',
  moduleName: 'koa-router',
  onRequire: require('./lib/router-instrumentation')
}, {
  type: 'web-framework',
  moduleName: '@koa/router',
  onRequire: require('./lib/router-instrumentation')
}, {
  type: 'web-framework',
  moduleName: 'koa-route',
  onRequire: require('./lib/route-instrumentation')
}]
