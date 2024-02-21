/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const toolsInstrumentation = require('./tools')
const cbManagerInstrumentation = require('./callback-manager')

module.exports = [
  {
    type: 'generic',
    moduleName: '@langchain/core/tools',
    onRequire: toolsInstrumentation
  },
  {
    type: 'generic',
    moduleName: '@langchain/core/dist/callbacks/manager',
    onRequire: cbManagerInstrumentation
  }
]
