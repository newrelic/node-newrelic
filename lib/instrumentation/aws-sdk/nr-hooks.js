/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const instrumentations = [
  {
    type: 'conglomerate',
    moduleName: 'aws-sdk',
    onRequire: require('./v2/instrumentation')
  },
  {
    type: 'conglomerate',
    moduleName: '@aws-sdk/smithy-client',
    onRequire: require('./v3/smithy-client'),
    shimName: 'aws-sdk'
  },
  {
    type: 'conglomerate',
    moduleName: '@smithy/smithy-client',
    onRequire: require('./v3/smithy-client'),
    shimName: 'aws-sdk'
  }
]

module.exports = instrumentations
