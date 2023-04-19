/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const proxyquire = require('proxyquire').noPreserveCache().noCallThru()
const sinon = require('sinon')

tap.test('Update Snyk PR Scripting', (testHarness) => {
  testHarness.autoend()

  let originalEnvVars
  let originalConsoleLog
  let MockGithubSdk
  let getPullRequestMock
  let updatePullRequestMock
  let script

  testHarness.beforeEach(() => {
    originalEnvVars = process.env
    originalConsoleLog = console.log

    console.log = sinon.stub().returns()
    getPullRequestMock = sinon.stub()
    updatePullRequestMock = sinon.stub()

    MockGithubSdk = sinon.stub().returns({
      getPullRequest: getPullRequestMock,
      updatePullRequest: updatePullRequestMock
    })

    script = proxyquire('../update-snyk-pr', {
      './github': MockGithubSdk
    })
  })

  testHarness.afterEach(() => {
    process.env = originalEnvVars
    console.log = originalConsoleLog
  })

  testHarness.test('should throw an error if SNYK_PR_ID is missing', async (t) => {
    delete process.env.SNYK_PR_ID
    t.rejects(() => script(), new Error('SNYK_PR_ID is a required environment variable'))
  })

  testHarness.test('should default the org/repo to agent', async (t) => {
    getPullRequestMock.resolves({ id: '1234', title: 'oh hi, mark' })
    updatePullRequestMock.resolves()
    process.env.SNYK_PR_ID = '1234'

    await script()

    t.equal(MockGithubSdk.callCount, 1, 'should instantiate the Github SDK')
    t.equal(MockGithubSdk.args[0][0], 'newrelic', 'should default to the newrelic org')
    t.equal(MockGithubSdk.args[0][1], 'node-newrelic', 'should default to the agent repo')
  })

  testHarness.test('should set org/repo based on RELEASE_REPO and RELEASE_ORG', async () => {
    getPullRequestMock.resolves({ id: '1234', title: 'hello from the other side' })
    updatePullRequestMock.resolves()
    process.env.SNYK_PR_ID = '1234'
    process.env.RELEASE_ORG = 'foo'
    process.env.RELEASE_REPO = 'bar'

    await script()

    testHarness.equal(MockGithubSdk.callCount, 1, 'should instantiate the Github SDK')
    testHarness.equal(MockGithubSdk.args[0][0], 'foo', 'should respect RELEASE_ORG')
    testHarness.equal(MockGithubSdk.args[0][1], 'bar', 'should respect RELEASE_REPO')
  })

  testHarness.test(
    'should not update the PR if it already has the correct conventional commit prefix',
    async (t) => {
      getPullRequestMock.resolves({ id: '1234', title: 'security: oh hi, mark' })
      updatePullRequestMock.resolves()
      process.env.SNYK_PR_ID = '1234'

      await script()

      t.equal(updatePullRequestMock.callCount, 0, 'should not have updated the PR')
      t.equal(console.log.args[0][0], 'PR #1234 already has correct prefix, skipping update')
    }
  )

  testHarness.test(
    'should update the PR with the security conventional commit prefix',
    async (t) => {
      getPullRequestMock.resolves({ id: '1234', title: 'hello from the other side' })
      updatePullRequestMock.resolves()
      process.env.SNYK_PR_ID = '1234'

      await script()

      t.equal(updatePullRequestMock.callCount, 1, 'should have called updatePullRequest')
      t.same(
        updatePullRequestMock.args[0][0],
        {
          id: '1234',
          title: 'security: hello from the other side'
        },
        'should have prepended the security prefix'
      )
    }
  )
})
