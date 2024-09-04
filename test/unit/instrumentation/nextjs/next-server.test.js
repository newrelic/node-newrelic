/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const initialize = require('../../../../lib/instrumentation/nextjs/next-server')
const helper = require('../../../lib/agent_helper')

test('middleware tracking', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    const Shim = require(`../../../../lib/shim/webframework-shim`)
    const shim = new Shim(agent, './next-server')
    sinon.stub(shim, 'require')
    sinon.stub(shim, 'setFramework')
    shim.require.returns({ version: '12.2.0' })
    sinon.spy(shim.logger, 'warn')
    ctx.nr.agent = agent
    ctx.nr.shim = shim
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test(
    'should instrument renderHTML, runMiddleware, runApi, and renderToResponseWithComponents',
    (t, end) => {
      const { shim } = t.nr
      const MockServer = createMockServer()
      initialize(shim, { default: MockServer })

      assert.ok(shim.isWrapped(MockServer.prototype.runMiddleware))
      assert.ok(shim.isWrapped(MockServer.prototype.runApi))
      assert.ok(shim.isWrapped(MockServer.prototype.renderHTML))
      assert.ok(shim.isWrapped(MockServer.prototype.renderToResponseWithComponents))
      assert.equal(
        shim.logger.warn.callCount,
        0,
        'should not long warning on middleware not being instrumented'
      )
      end()
    }
  )

  await t.test('should not instrument runMiddleware if Next.js < 12.2.0', (t, end) => {
    const { shim } = t.nr
    shim.require.returns({ version: '12.0.1' })
    const NewFakeServer = createMockServer()
    initialize(shim, { default: NewFakeServer })
    assert.equal(shim.logger.warn.callCount, 1, 'should log warn message')
    const loggerArgs = shim.logger.warn.args[0]
    assert.deepEqual(loggerArgs, [
      'Next.js middleware instrumentation only supported on >=12.2.0 <=13.4.12, got %s',
      '12.0.1'
    ])
    assert.equal(
      shim.isWrapped(NewFakeServer.prototype.runMiddleware),
      false,
      'should not wrap getModuleContext when version is less than 12.2.0'
    )
    end()
  })
})

function createMockServer() {
  function FakeServer() {}
  FakeServer.prototype.renderToResponseWithComponents = sinon.stub()
  FakeServer.prototype.runApi = sinon.stub()
  FakeServer.prototype.renderHTML = sinon.stub()
  FakeServer.prototype.runMiddleware = sinon.stub()
  return FakeServer
}
