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
    type: 'generic',
    moduleName: '@aws-sdk/smithy-client',
    onResolved: require('./lib/smithy-client')
  },
  {
    type: 'message',
    moduleName: '@aws-sdk/client-sns',
    onResolved: require('./lib/v3-sns')
  },
  {
    type: 'datastore',
    moduleName: '@aws-sdk/client-dynamodb',
    onResolved: require('./lib/v3-client-dynamodb')
  },
  {
    type: 'datastore',
    moduleName: '@aws-sdk/lib-dynamodb',
    onResolved: require('./lib/v3-dynamodb-doc-client')
  }
]
