/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const InstrumentationDescriptor = require('./instrumentation-descriptor')

module.exports = {
  http: {
    type: InstrumentationDescriptor.TYPE_TRANSACTION,
    file: 'http.js'
  },
  https: {
    type: InstrumentationDescriptor.TYPE_TRANSACTION,
    file: 'http.js'
  },
  timers: {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    file: 'timers.js'
  }
}
