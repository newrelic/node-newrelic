/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const coreInstrumentation = require('./core')
const langchainInstrumentation = require('./langchain')
const communityInstrumentation = require('./community')

module.exports = [
  {
    type: 'generic',
    moduleName: '@langchain/core',
    onRequire: coreInstrumentation
  },
  {
    type: 'generic',
    moduleName: 'langchain',
    onRequire: langchainInstrumentation
  },
  {
    type: 'generic',
    moduleName: '@langchain/community',
    onRequire: communityInstrumentation
  }
]
