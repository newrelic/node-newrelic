/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const instrument = require('./otel')
const InstrumentationDescriptor = require('../../instrumentation-descriptor')

module.exports = [
  {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    moduleName: '@opentelemetry/sdk-trace-node',
    onRequire: instrument
  }
]
