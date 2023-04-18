/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const instrumentation = require('./mysql')

module.exports = [
  {
    type: 'datastore',
    moduleName: 'mysql',
    onRequire: instrumentation.callbackInitialize
  },
  {
    type: 'datastore',
    moduleName: 'mysql2',
    onRequire: instrumentation.callbackInitialize
  },
  {
    type: 'datastore',
    moduleName: 'mysql2/promise',
    onRequire: instrumentation.promiseInitialize
  }
]
