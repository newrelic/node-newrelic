/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const instrumentation = require('./index')

module.exports = [
  {
    type: null,
    moduleName: 'when',
    onRequire: instrumentation
  }
]
