/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const pino = require('./pino')
const InstrumentationDescriptor = require('../../instrumentation-descriptor')

/**
 * Need to use nr-hooks style because we are instrumenting a submodule.
 */
module.exports = [
  {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    moduleName: 'pino/lib/tools',
    onRequire: pino
  }
]
