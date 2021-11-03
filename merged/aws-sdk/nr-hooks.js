/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = [
  {
    type: 'conglomerate',
    moduleName: 'aws-sdk',
    onRequire: require('./lib/instrumentation')
  },
  {
    type: 'message',
    moduleName: '@aws-sdk/client-sns',
    onRequire: require('./lib/v3-sns')
  },
  {
    type: 'generic',
    moduleName: './MiddlewareStack',
    onRequire: require('./lib/mw-stack')
  },
  {
    type: 'generic',
    moduleName: '@aws-sdk/smithy-client',
    onRequire: require('./lib/smithy-client')
  },
  {
    type: 'generic',
    moduleName: '@aws-sdk/node-http-handler',
    onRequire: require('./lib/http-handler')
  }
]
