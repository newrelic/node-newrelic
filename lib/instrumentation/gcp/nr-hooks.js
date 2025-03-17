/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const InstrumentationDescriptor = require('../../instrumentation-descriptor')

const instrumentations = [
  {
    type: InstrumentationDescriptor.TYPE_MESSAGE,
    moduleName: '@google-cloud/pubsub',
    onRequire: require('./pubsub')
  }
]

module.exports = instrumentations
