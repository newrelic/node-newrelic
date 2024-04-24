/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const instrumentation = require('./mysql')
const InstrumentationDescriptor = require('../../instrumentation-descriptor')

module.exports = [
  {
    type: InstrumentationDescriptor.TYPE_DATASTORE,
    moduleName: 'mysql',
    onRequire: instrumentation.callbackInitialize
  },
  {
    type: InstrumentationDescriptor.TYPE_DATASTORE,
    moduleName: 'mysql2',
    onRequire: instrumentation.callbackInitialize
  },
  {
    type: InstrumentationDescriptor.TYPE_DATASTORE,
    moduleName: 'mysql2/promise',
    onRequire: instrumentation.promiseInitialize
  }
]
