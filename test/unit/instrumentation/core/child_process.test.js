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

  await t.test('should not re-wrap exec/execFile on repeated initialize calls', () => {
    const fakeChildProcess = {
      exec: function exec() {},
      execFile: function execFile() {}
    }

    childProcessInstrumentation(agent, fakeChildProcess)
    const wrappedExec = fakeChildProcess.exec
    const wrappedExecFile = fakeChildProcess.execFile

    childProcessInstrumentation(agent, fakeChildProcess)

    assert.equal(fakeChildProcess.exec, wrappedExec, 'exec should not be wrapped a second time')
    assert.equal(fakeChildProcess.execFile, wrappedExecFile, 'execFile should not be wrapped a second time')
  })
})
