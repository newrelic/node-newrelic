/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const createImplementation = require('../../../lib/context-manager/create-context-manager')
const AsyncLocalContextManager = require('../../../lib/context-manager/async-local-context-manager')

test('Should return AsyncLocalContextManager by default', () => {
  const contextManager = createImplementation({
    logging: {},
    feature_flag: {}
  })

  assert.equal(contextManager instanceof AsyncLocalContextManager, true)
})
