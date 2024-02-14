/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const runnableInst = require('./runnable')
const cbManagerInstrumentation = require('./callback-manager')

module.exports = [
  {
    type: 'generic',
    moduleName: '@langchain/core/dist/runnables/base',
    onRequire: runnableInst
  },
  {
    type: 'generic',
    moduleName: '@langchain/core/dist/callbacks/manager',
    onRequire: cbManagerInstrumentation
  }
]
