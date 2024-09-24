/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')

test("requiring express a bunch of times shouldn't leak listeners", function () {
  const agent = helper.instrumentMockedAgent()
  require('express')
  const numListeners = agent.listeners('transactionFinished').length
  require('express')
  assert.equal(agent.listeners('transactionFinished').length, numListeners)
})
