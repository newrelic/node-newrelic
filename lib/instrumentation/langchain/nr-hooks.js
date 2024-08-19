/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const toolsInstrumentation = require('./tools')
const cbManagerInstrumentation = require('./callback-manager')
const runnableInstrumentation = require('./runnable')
const vectorstoreInstrumentation = require('./vectorstore')
const InstrumentationDescriptor = require('../../instrumentation-descriptor')

module.exports = [
  {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    moduleName: '@langchain/core/tools',
    onRequire: toolsInstrumentation
  },
  {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    moduleName: '@langchain/core/dist/callbacks/manager',
    onRequire: cbManagerInstrumentation
  },
  {
    // This block is for catching langchain internal imports
    // of the callback manager. See:
    // https://github.com/elastic/require-in-the-middle/pull/88#issuecomment-2124940546
    type: InstrumentationDescriptor.TYPE_GENERIC,
    moduleName: '@langchain/core/dist/callbacks/manager.cjs',
    onRequire: cbManagerInstrumentation
  },
  {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    moduleName: '@langchain/core/runnables',
    onRequire: runnableInstrumentation
  },
  {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    moduleName: '@langchain/core/vectorstores',
    onRequire: vectorstoreInstrumentation
  }
]
