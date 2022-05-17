/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const pino = require('./pino')

/**
 * We only need to register the instrumentation once for both mysql and mysql2
 *  because there is some 🪄 in shimmer
 * See: https://github.com/newrelic/node-newrelic/blob/main/lib/shimmer.js#L459
 */
module.exports = [
  {
    type: 'generic',
    moduleName: 'pino',
    onResolved: pino
  }
]
