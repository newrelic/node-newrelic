/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const InstrumentationDescriptor = require('../../instrumentation-descriptor')

module.exports = [
  {
    type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
    moduleName: 'koa',
    shimName: 'koa',
    onRequire: require('./instrumentation')
  },
  {
    type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
    moduleName: 'koa-router',
    shimName: 'koa',
    onRequire: require('./router-instrumentation')
  },
  {
    type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
    moduleName: '@koa/router',
    shimName: 'koa',
    onRequire: require('./router-instrumentation')
  },
  {
    type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
    moduleName: 'koa-route',
    shimName: 'koa',
    onRequire: require('./route-instrumentation')
  }
]
