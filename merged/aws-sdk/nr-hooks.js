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
    type: 'message',
    moduleName: '@aws-sdk/client-dynamodb',
    onResolved: require('./lib/v3-dynamo-ddb')
  }
]
