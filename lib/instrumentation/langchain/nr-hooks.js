/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const promptInstrumentation = require('./prompts')

module.exports = [
  {
    type: 'generic',
    moduleName: '@langchain/core/prompts',
    onRequire: promptInstrumentation
  }
]
