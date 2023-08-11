/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const pino = require('./pino')

/**
 * Need to use nr-hooks style because we are instrumenting a submodule.
 */
module.exports = [
  {
    type: 'generic',
    moduleName: 'pino/lib/tools',
    onRequire: pino
  }
]
