/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const promptInstrumentation = require('./prompts')
const chatInstrumentation = require('./chat')

module.exports = [
  {
    type: 'generic',
    moduleName: '@langchain/core/prompts',
    onRequire: promptInstrumentation
  },
  {
    type: 'generic',
    moduleName: '@langchain/core/language_models/chat_models',
    onRequire: chatInstrumentation
  }
]
