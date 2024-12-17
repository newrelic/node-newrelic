/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire').noPreserveCache().noCallThru()
const sinon = require('sinon')

test('Update Snyk PR Scripting', async (t) => {
  t.beforeEach((ctx) => {
    const originalEnvVars = process.env
    const originalConsoleLog = console.log

    console.log = sinon.stub().returns()
    const getPullRequestMock = sinon.stub()
    const updatePullRequestMock = sinon.stub()

    const MockGithubSdk = sinon.stub().returns({
      getPullRequest: getPullRequestMock,
      updatePullRequest: updatePullRequestMock
    })

    const script = proxyquire('../update-snyk-pr', {
      './github': MockGithubSdk
    })
    ctx.nr = {
      originalEnvVars,
      originalConsoleLog,
      getPullRequestMock,
      updatePullRequestMock,
      MockGithubSdk,
      script
    }
  })

  t.afterEach((ctx) => {
    process.env = ctx.nr.originalEnvVars
    console.log = ctx.nr.originalConsoleLog
  })

  await t.test('should throw an error if SNYK_PR_ID is missing', async (t) => {
    const { script } = t.nr
    delete process.env.SNYK_PR_ID
    await assert.rejects(() => script(), {
      message: 'SNYK_PR_ID is a required environment variable'
    })
  })

  await t.test('should default the org/repo to agent', async (t) => {
    const { getPullRequestMock, updatePullRequestMock, script, MockGithubSdk } = t.nr
    getPullRequestMock.resolves({ id: '1234', title: 'oh hi, mark' })
    updatePullRequestMock.resolves()
    process.env.SNYK_PR_ID = '1234'

    await script()

    assert.equal(MockGithubSdk.callCount, 1, 'should instantiate the Github SDK')
    assert.equal(MockGithubSdk.args[0][0], 'newrelic', 'should default to the newrelic org')
    assert.equal(MockGithubSdk.args[0][1], 'node-newrelic', 'should default to the agent repo')
  })

  await t.test('should set org/repo based on RELEASE_REPO and RELEASE_ORG', async (t) => {
    const { getPullRequestMock, updatePullRequestMock, script, MockGithubSdk } = t.nr
    getPullRequestMock.resolves({ id: '1234', title: 'hello from the other side' })
    updatePullRequestMock.resolves()
    process.env.SNYK_PR_ID = '1234'
    process.env.RELEASE_ORG = 'foo'
    process.env.RELEASE_REPO = 'bar'

    await script()

    assert.equal(MockGithubSdk.callCount, 1, 'should instantiate the Github SDK')
    assert.equal(MockGithubSdk.args[0][0], 'foo', 'should respect RELEASE_ORG')
    assert.equal(MockGithubSdk.args[0][1], 'bar', 'should respect RELEASE_REPO')
  })

  await t.test(
    'should not update the PR if it already has the correct conventional commit prefix',
    async (t) => {
      const { getPullRequestMock, updatePullRequestMock, script } = t.nr
      getPullRequestMock.resolves({ id: '1234', title: 'security: oh hi, mark' })
      updatePullRequestMock.resolves()
      process.env.SNYK_PR_ID = '1234'

      await script()

      assert.equal(updatePullRequestMock.callCount, 0, 'should not have updated the PR')
      assert.equal(console.log.args[0][0], 'PR #1234 already has correct prefix, skipping update')
    }
  )

  await t.test('should update the PR with the security conventional commit prefix', async (t) => {
    const { getPullRequestMock, updatePullRequestMock, script } = t.nr
    getPullRequestMock.resolves({ id: '1234', title: 'hello from the other side' })
    updatePullRequestMock.resolves()
    process.env.SNYK_PR_ID = '1234'

    await script()

    assert.equal(updatePullRequestMock.callCount, 1, 'should have called updatePullRequest')
    assert.deepEqual(
      updatePullRequestMock.args[0][0],
      {
        id: '1234',
        title: 'security: hello from the other side'
      },
      'should have prepended the security prefix'
    )
  })
})
