/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const helper = require('#testlib/agent_helper.js')
const logger = require('#agentlib/logger.js')
const childProcessInstrumentation = require('#agentlib/instrumentation/core/child_process.js')

test('child_process instrumentation', async (t) => {
  const agent = helper.loadMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })

  await t.test('should log and return false when child_process is not available', (t) => {
    const proto = Object.getPrototypeOf(logger.child({}))
    const debugStub = sinon.stub(proto, 'debug')
    t.after(() => {
      debugStub.restore()
    })

    const result = childProcessInstrumentation(agent, null)

    assert.equal(result, false)
    assert.ok(debugStub.calledWith('Could not find child_process, not instrumenting'))
  })
})
