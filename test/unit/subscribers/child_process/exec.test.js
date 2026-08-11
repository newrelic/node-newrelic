/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const cp = require('child_process')
const helper = require('#testlib/agent_helper.js')
const logger = require('#agentlib/logger.js')
const ChildProcessExec = require('#agentlib/subscribers/child_process/exec.js')

test('ChildProcessExec subscriber', async (t) => {
  const agent = helper.loadMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })

  await t.test('should only wrap cp.exec once, even across multiple enable() calls', () => {
    const original = cp.exec

    const first = new ChildProcessExec({ agent, logger })
    first.enable()
    const wrapped = cp.exec
    assert.notEqual(wrapped, original, 'exec should be wrapped after enable()')

    const second = new ChildProcessExec({ agent, logger })
    second.enable()

    assert.equal(cp.exec, wrapped, 'exec should not be wrapped a second time')
  })
})
