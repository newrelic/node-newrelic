/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../lib/agent_helper')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

tap.beforeEach((t) => {
  const sandbox = sinon.createSandbox()
  t.context.sandbox = sandbox
  t.context.agent = helper.loadMockedAgent()
  t.context.initialize = proxyquire('../../../lib/instrumentation/mongodb', {
    './mongodb/v4-mongo': function stub() {}
  })
  const shim = {
    setDatastore: sandbox.stub(),
    pkgVersion: '4.0.0',
    logger: {
      warn: sandbox.stub()
    }
  }
  shim.pkgVersion = '4.0.0'
  t.context.shim = shim
})

tap.afterEach((t) => {
  helper.unloadAgent(t.context.agent)
  t.context.sandbox.restore()
})

tap.test('should not log warning if version is >= 4', function (t) {
  const { agent, shim, initialize } = t.context
  initialize(agent, {}, 'mongodb', shim)
  t.equal(shim.logger.warn.callCount, 0)
  t.equal(shim.setDatastore.callCount, 1)
  t.end()
})

tap.test('should log warning if using unsupported version of mongo', function (t) {
  const { agent, shim, initialize } = t.context
  shim.pkgVersion = '2.0.0'
  initialize(agent, {}, 'mongodb', shim)
  t.same(shim.logger.warn.args[0], [
    'New Relic Node.js agent no longer supports mongodb < 4, current version %s. Please downgrade to v11 for support, if needed',
    '2.0.0'
  ])
  t.end()
})
