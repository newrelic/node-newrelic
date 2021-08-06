/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = [
  {
    type: 'generic',
    moduleName: 'superagent',
    onRequire: require('./lib/instrumentation')
  }
]
