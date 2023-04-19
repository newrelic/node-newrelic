/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const proxyquire = require('proxyquire').noPreserveCache().noCallThru()
const sinon = require('sinon')

tap.test('Add Support Statement Scripting', (testHarness) => {
  testHarness.autoend()

  let originalEnvVars
  let originalConsoleLog
  let MockGithubSdk
  let getReleaseByTagMock
  let updateReleaseMock
  let script

  testHarness.beforeEach(() => {
    originalEnvVars = process.env
    originalConsoleLog = console.log
    getReleaseByTagMock = sinon.stub()
    updateReleaseMock = sinon.stub()

    console.log = sinon.stub().returns()

    MockGithubSdk = sinon.stub().returns({
      getReleaseByTag: getReleaseByTagMock,
      updateRelease: updateReleaseMock
    })

    script = proxyquire('../add-support-statement', {
      './github': MockGithubSdk
    })
  })

  testHarness.afterEach(() => {
    process.env = originalEnvVars
    console.log = originalConsoleLog
  })

  testHarness.test('should throw if RELEASE_TAG is not set as env var', async (t) => {
    delete process.env.RELEASE_TAG
    t.rejects(() => script(), new Error('RELEASE_TAG is a required environment variable'))
  })

  testHarness.test('should throw if RELEASE_TAG is empty string', async (t) => {
    process.env.RELEASE_TAG = ''
    t.rejects(() => script(), new Error('RELEASE_TAG is a required environment variable'))
  })

  testHarness.test('should default the org/repo to agent', async (t) => {
    getReleaseByTagMock.resolves({ id: '12345', body: 'oh hi, mark' })
    updateReleaseMock.resolves()
    process.env.RELEASE_TAG = 'v1.0.0'

    await script()

    t.equal(MockGithubSdk.callCount, 1, 'should instantiate the Github SDK')
    t.equal(MockGithubSdk.args[0][0], 'newrelic', 'should default to the newrelic org')
    t.equal(MockGithubSdk.args[0][1], 'node-newrelic', 'should default to the agent repo')
  })

  testHarness.test('should set org/repo based on RELEASE_REPO and RELEASE_ORG', async () => {
    getReleaseByTagMock.resolves({ id: '12345', body: 'hello from the other side' })
    updateReleaseMock.resolves()
    process.env.RELEASE_TAG = 'v1.0.0'
    process.env.RELEASE_ORG = 'foo'
    process.env.RELEASE_REPO = 'bar'

    await script()

    testHarness.equal(MockGithubSdk.callCount, 1, 'should instantiate the Github SDK')
    testHarness.equal(MockGithubSdk.args[0][0], 'foo', 'should respect RELEASE_ORG')
    testHarness.equal(MockGithubSdk.args[0][1], 'bar', 'should respect RELEASE_REPO')
  })

  testHarness.test(
    'should not update the GH release if support statement already exists',
    async (t) => {
      getReleaseByTagMock.resolves({ id: '12345', body: '### Support statement: oh hi, mark' })
      updateReleaseMock.resolves()
      process.env.RELEASE_TAG = 'v1.0.0'

      await script()

      t.equal(updateReleaseMock.callCount, 0, 'should not have updated the GH release')
      t.equal(console.log.args[0][0], 'Release 12345 already has support statement, skipping')
    }
  )

  testHarness.test('should update the GH release', async (t) => {
    getReleaseByTagMock.resolves({ id: '12345', body: 'saying hello hello hello hello' })
    updateReleaseMock.resolves()
    process.env.RELEASE_TAG = 'v1.0.0'

    await script()

    t.equal(updateReleaseMock.callCount, 1, 'should have called updateRelease')
    t.same(
      updateReleaseMock.args[0][0],
      {
        release_id: '12345',
        body: `saying hello hello hello hello\n### Support statement:\n* New Relic recommends that you upgrade the agent regularly to ensure that you're getting the latest features and performance benefits. Additionally, older releases will no longer be supported when they reach [end-of-life](https://docs.newrelic.com/docs/using-new-relic/cross-product-functions/install-configure/notification-changes-new-relic-saas-features-distributed-software).`
      },
      'should have appended the support statement'
    )
  })
})
