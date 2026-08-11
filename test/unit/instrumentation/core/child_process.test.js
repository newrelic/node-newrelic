/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const childProcessInstrumentation = require('#agentlib/instrumentation/core/child_process.js')

test('child_process instrumentation', async (t) => {
  const agent = helper.loadMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })

  await t.test('should log and return false when child_process is not available', () => {
    const debugCalls = []
    const stubLogger = { debug: (msg) => debugCalls.push(msg) }

    const result = childProcessInstrumentation(agent, null, { logger: stubLogger })

    assert.equal(result, false)
    assert.deepEqual(debugCalls, ['Could not find child_process, not instrumenting'])
  })

  await t.test('teardown should restore the original exec/execFile', () => {
    const originalExec = function exec() {}
    const originalExecFile = function execFile() {}
    const fakeChildProcess = { exec: originalExec, execFile: originalExecFile }

    const instrumentation = childProcessInstrumentation(agent, fakeChildProcess)
    assert.notEqual(fakeChildProcess.exec, originalExec, 'exec should be wrapped after patch')
    assert.notEqual(fakeChildProcess.execFile, originalExecFile, 'execFile should be wrapped after patch')

    instrumentation.teardown()

    assert.equal(fakeChildProcess.exec, originalExec, 'exec should be restored after teardown')
    assert.equal(fakeChildProcess.execFile, originalExecFile, 'execFile should be restored after teardown')
  })

  await t.test('should not double-wrap after a teardown/re-patch cycle', () => {
    const originalExec = function exec() {}
    const fakeChildProcess = { exec: originalExec, execFile: function execFile() {} }

    const first = childProcessInstrumentation(agent, fakeChildProcess)
    first.teardown()

    const second = childProcessInstrumentation(agent, fakeChildProcess)

    assert.equal(second.originals.exec, originalExec, 'second patch should have wrapped the true original, not a stale wrapper')
  })
})
