/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const InstrumentationDescriptor = require('./instrumentation-descriptor')

module.exports = {
  child_process: {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    file: 'child_process.js'
  },
  crypto: {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    file: 'crypto.js'
  },
  dns: {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    file: 'dns.js'
  },
  fs: {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    file: 'fs.js'
  },
  http: {
    type: InstrumentationDescriptor.TYPE_TRANSACTION,
    file: 'http.js'
  },
  https: {
    type: InstrumentationDescriptor.TYPE_TRANSACTION,
    file: 'http.js'
  },
  inspector: {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    file: 'inspector.js'
  },
  net: {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    file: 'net.js'
  },
  timers: {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    file: 'timers.js'
  },
  zlib: {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    file: 'zlib.js'
  }
}
