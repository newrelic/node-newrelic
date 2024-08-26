/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

test.beforeEach((ctx) => {
  ctx.nr = {}
  const sandbox = sinon.createSandbox()
  ctx.nr.sandbox = sandbox
  ctx.nr.agent = helper.loadMockedAgent()
  ctx.nr.initialize = proxyquire('../../../lib/instrumentation/mongodb', {
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
  ctx.nr.shim = shim
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.sandbox.restore()
})

test('should not log warning if version is >= 4', async function (t) {
  const { agent, shim, initialize } = t.nr
  initialize(agent, {}, 'mongodb', shim)
  assert.equal(shim.logger.warn.callCount, 0)
  assert.equal(shim.setDatastore.callCount, 1)
})

test('should log warning if using unsupported version of mongo', async function (t) {
  const { agent, shim, initialize } = t.nr
  shim.pkgVersion = '2.0.0'
  initialize(agent, {}, 'mongodb', shim)
  assert.deepEqual(shim.logger.warn.args[0], [
    'New Relic Node.js agent no longer supports mongodb < 4, current version %s. Please downgrade to v11 for support, if needed',
    '2.0.0'
  ])
})
