/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const testTransactionState = require(`../../lib/promises/transaction-state`)

// We cannot use `test.beforeEach` and `test.afterEach` with this suite because
// of the `testTransactionState` waterfall tests. Those setup nested subtests
// which will each execute the `beforeEach`. Due to the singleton nature of
// the mocked agent, this causes cascading failures that would be too difficult
// to resolve.

function setupAgent(t) {
  const agent = helper.instrumentMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })
}

test('Promise constructor retains all properties', function (t) {
  let Promise = require('when').Promise
  const originalKeys = Object.keys(Promise)

  setupAgent(t)
  Promise = require('when').Promise
  const wrappedKeys = Object.keys(Promise)

  originalKeys.forEach(function (key) {
    if (wrappedKeys.indexOf(key) === -1) {
      assert.ok(0, 'Property ' + key + ' is not present on wrapped Promise')
    }
  })
})

test('transaction state', async function (t) {
  const agent = helper.instrumentMockedAgent()
  const when = require('when')
  const Promise = when.Promise

  t.after(() => {
    helper.unloadAgent(agent)
  })

  await testTransactionState({ t, agent, Promise, library: when })
})
