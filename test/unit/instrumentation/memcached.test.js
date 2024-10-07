/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const test = require('node:test')
const assert = require('node:assert')

test('agent instrumentation of memcached should not cause bootstrapping to fail', async function (t) {
  const agent = helper.loadTestAgent(t)
  const initialize = require('../../../lib/instrumentation/memcached')

  await t.test('when passed no module', async function () {
    assert.doesNotThrow(() => {
      initialize(agent)
    })
  })

  await t.test('when passed an empty module', async function () {
    assert.doesNotThrow(() => {
      initialize(agent, {})
    })
  })
})
