/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const test = require('node:test')
const testTransactionState = require('../../lib/promises/transaction-state')

test('bluebird', async function (t) {
  const agent = helper.instrumentMockedAgent()
  const Promise = require('bluebird')

  t.after(() => {
    helper.unloadAgent(agent)
  })

  await testTransactionState({ t, agent, Promise })
})
