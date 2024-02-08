/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const runnableInst = require('./runnable')

module.exports = [
  {
    type: 'generic',
    moduleName: '@langchain/core/dist/runnables/base',
    onRequire: runnableInst
  }
]
