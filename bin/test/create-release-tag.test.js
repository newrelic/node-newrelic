/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const { removeModules } = require('#testlib/cache-buster.js')

function afterEach() {
  removeModules(['commander'])
}

test('Create Release Tag script', async (t) => {
  await t.test('validateLocalChanges', async (t) => {
    t.beforeEach((ctx) => {
      const mockGitCommands = {
        getLocalChanges: sinon.stub(),
        getCurrentBranch: sinon.stub(),
        getPushRemotes: sinon.stub()
      }
      const script = proxyquire('../create-release-tag', {
        './git-commands': mockGitCommands,
        './check-workflow-run': sinon.stub()
      })
      ctx.nr = { mockGitCommands, script }
    })

    t.afterEach(afterEach)

    await t.test('should return true when no local changes exist', async (t) => {
      const { mockGitCommands, script } = t.nr
      mockGitCommands.getLocalChanges.resolves([])

      const result = await script.validateLocalChanges()

      assert.equal(result, true)
    })

    await t.test('should return false when local changes exist', async (t) => {
      const { mockGitCommands, script } = t.nr
      mockGitCommands.getLocalChanges.resolves(['modified: lib/foo.js'])

      const result = await script.validateLocalChanges()

      assert.equal(result, false)
    })

    await t.test('should return false when git throws an error', async (t) => {
      const { mockGitCommands, script } = t.nr
      mockGitCommands.getLocalChanges.rejects(new Error('git error'))

      const result = await script.validateLocalChanges()

      assert.equal(result, false)
    })
  })

  await t.test('validateCurrentBranch', async (t) => {
    t.beforeEach((ctx) => {
      const mockGitCommands = {
        getLocalChanges: sinon.stub(),
        getCurrentBranch: sinon.stub(),
        getPushRemotes: sinon.stub()
      }
      const script = proxyquire('../create-release-tag', {
        './git-commands': mockGitCommands,
        './check-workflow-run': sinon.stub()
      })
      ctx.nr = { mockGitCommands, script }
    })

    t.afterEach(afterEach)

    await t.test('should return true when current branch matches expected', async (t) => {
      const { mockGitCommands, script } = t.nr
      mockGitCommands.getCurrentBranch.resolves('main')

      const result = await script.validateCurrentBranch('main')

      assert.equal(result, true)
    })

    await t.test('should return false when current branch does not match', async (t) => {
      const { mockGitCommands, script } = t.nr
      mockGitCommands.getCurrentBranch.resolves('feature-branch')

      const result = await script.validateCurrentBranch('main')

      assert.equal(result, false)
    })

    await t.test('should return false when git throws an error', async (t) => {
      const { mockGitCommands, script } = t.nr
      mockGitCommands.getCurrentBranch.rejects(new Error('git error'))

      const result = await script.validateCurrentBranch('main')

      assert.equal(result, false)
    })
  })
})
