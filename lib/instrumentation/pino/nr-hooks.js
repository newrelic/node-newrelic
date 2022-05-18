/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const pino = require('./pino')

/**
 * Need to use nr-hooks style for pino because we're using the onResolved hook
 * to register instrumentation.
 */
module.exports = [
  {
    type: 'generic',
    moduleName: 'pino',
    onResolved: pino
  }
]
