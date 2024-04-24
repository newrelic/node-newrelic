/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const InstrumentationDescriptor = require('../../instrumentation-descriptor')

const instrumentations = [
  {
    type: InstrumentationDescriptor.TYPE_CONGLOMERATE,
    moduleName: 'aws-sdk',
    onRequire: require('./v2/instrumentation')
  },
  {
    type: InstrumentationDescriptor.TYPE_CONGLOMERATE,
    moduleName: '@aws-sdk/smithy-client',
    onRequire: require('./v3/smithy-client'),
    shimName: 'aws-sdk'
  },
  {
    type: InstrumentationDescriptor.TYPE_CONGLOMERATE,
    moduleName: '@smithy/smithy-client',
    onRequire: require('./v3/smithy-client'),
    shimName: 'aws-sdk'
  }
]

module.exports = instrumentations
