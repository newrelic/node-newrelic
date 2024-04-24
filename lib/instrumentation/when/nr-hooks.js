/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const instrumentation = require('./index')
const InstrumentationDescriptor = require('../../instrumentation-descriptor')

module.exports = [
  {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    moduleName: 'when',
    onRequire: instrumentation
  }
]
