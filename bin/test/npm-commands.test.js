/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire').noPreserveCache()
const sinon = require('sinon')

const SCRIPT_PATH = '../npm-commands'

test('npm-commands', async (t) => {
  t.beforeEach((ctx) => {
    const sandbox = sinon.createSandbox()
    const execStub = sandbox.stub()
    const npmCommands = proxyquire(SCRIPT_PATH, {
      child_process: { execFile: execStub }
    })
    ctx.nr = { execStub, npmCommands, sandbox }
  })

  t.afterEach((ctx) => {
    ctx.nr.sandbox.restore()
  })

  await t.test('version', async (t) => {
    await t.test('calls execFile with npm and version args when shouldCommitAndTag is true', async (t) => {
      const { execStub, npmCommands } = t.nr
      execStub.yields(null, '')

      await npmCommands.version('minor', true)

      assert.ok(execStub.calledOnce)
      assert.ok(execStub.calledWith('npm', ['version', 'minor']))
    })

    await t.test('appends --no-git-tag-version when shouldCommitAndTag is false', async (t) => {
      const { execStub, npmCommands } = t.nr
      execStub.yields(null, '')

      await npmCommands.version('minor', false)

      assert.ok(execStub.calledOnce)
      assert.ok(execStub.calledWith('npm', ['version', 'minor', '--no-git-tag-version']))
    })

    await t.test('appends --no-git-tag-version when shouldCommitAndTag is undefined', async (t) => {
      const { execStub, npmCommands } = t.nr
      execStub.yields(null, '')

      await npmCommands.version('1.2.3')

      assert.ok(execStub.calledOnce)
      assert.ok(execStub.calledWith('npm', ['version', '1.2.3', '--no-git-tag-version']))
    })

    await t.test('resolves with stdout on success', async (t) => {
      const { execStub, npmCommands } = t.nr
      execStub.yields(null, 'v1.2.3\n')

      const result = await npmCommands.version('patch', true)

      assert.equal(result, undefined)
      assert.ok(execStub.calledOnce)
    })

    await t.test('rejects when execFile returns an error', async (t) => {
      const { execStub, npmCommands } = t.nr
      const execError = new Error('npm version failed')
      execStub.yields(execError, null)

      await assert.rejects(
        () => npmCommands.version('minor', true),
        execError
      )
    })

    await t.test('passes shell metacharacters as a literal argument without shell expansion', async (t) => {
      const { execStub, npmCommands } = t.nr
      const malicious = '$(echo injected)'
      execStub.yields(null, '')

      await npmCommands.version(malicious, false)

      // execFile is called with the raw string as an array element — no shell involved
      assert.ok(execStub.calledWith('npm', ['version', malicious, '--no-git-tag-version']))
    })
  })
})
