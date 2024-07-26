/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const initialize = require('../../../../lib/instrumentation/nextjs/next-server')
const helper = require('../../../lib/agent_helper')

tap.test('middleware tracking', (t) => {
  t.autoend()
  let MockServer
  let agent
  let shim

  function createMockServer() {
    function FakeServer() {}
    FakeServer.prototype.renderToResponseWithComponents = sinon.stub()
    FakeServer.prototype.runApi = sinon.stub()
    FakeServer.prototype.renderHTML = sinon.stub()
    FakeServer.prototype.runMiddleware = sinon.stub()
    return FakeServer
  }

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    const Shim = require(`../../../../lib/shim/webframework-shim`)
    shim = new Shim(agent, './next-server')
    sinon.stub(shim, 'require')
    sinon.stub(shim, 'setFramework')
    shim.require.returns({ version: '12.2.0' })
    sinon.spy(shim.logger, 'warn')

    MockServer = createMockServer()
    initialize(shim, { default: MockServer })
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test(
    'should instrument renderHTML, runMiddleware, runApi, and renderToResponseWithComponents',
    (t) => {
      t.ok(shim.isWrapped(MockServer.prototype.runMiddleware))
      t.ok(shim.isWrapped(MockServer.prototype.runApi))
      t.ok(shim.isWrapped(MockServer.prototype.renderHTML))
      t.ok(shim.isWrapped(MockServer.prototype.renderToResponseWithComponents))
      t.equal(
        shim.logger.warn.callCount,
        0,
        'should not long warning on middleware not being instrumented'
      )
      t.end()
    }
  )

  t.test('should not instrument runMiddleware if Next.js < 12.2.0', (t) => {
    shim.require.returns({ version: '12.0.1' })
    const NewFakeServer = createMockServer()
    initialize(shim, { default: NewFakeServer })
    t.equal(shim.logger.warn.callCount, 1, 'should log warn message')
    const loggerArgs = shim.logger.warn.args[0]
    t.same(loggerArgs, [
      'Next.js middleware instrumentation only supported on >=12.2.0 <=13.4.12, got %s',
      '12.0.1'
    ])
    t.notOk(
      shim.isWrapped(NewFakeServer.prototype.runMiddleware),
      'should not wrap getModuleContext when version is less than 12.2.0'
    )
    t.end()
  })
})
