/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const runContextManagerTests = require('./context-manager-tests')
const AsyncLocalContextManager = require('../../../lib/context-manager/async-local-context-manager')

test('Async Local Context Manager', async (t) => {
  await runContextManagerTests(t, createContextManager)
})

function createContextManager() {
  return new AsyncLocalContextManager({})
}
