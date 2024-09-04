/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('assert')
const test = require('node:test')
const helper = require('../../../lib/agent_helper')
const sinon = require('sinon')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('SuperAgent instrumentation', (t, end) => {
  helper.unloadAgent(t.nr.agent)
  t.nr.agent = helper.loadMockedAgent({
    moduleName: 'superagent',
    type: 'generic',
    onRequire: '../../lib/instrumentation'
  })
  const superagent = require('superagent')

  assert.ok(superagent.Request, 'should not remove Request class')
  assert.equal(typeof superagent.Request.prototype.then, 'function')
  assert.equal(typeof superagent.Request.prototype.end, 'function')

  end()
})

test('should not wrap superagent if it is not a function', (t, end) => {
  const api = helper.getAgentApi()
  api.shim.logger.debug = sinon.stub()
  const instrumentation = require('../../../../lib/instrumentation/superagent')
  const superagentMock = { foo: 'bar' }
  instrumentation(t.nr.agent, superagentMock, 'superagent', api.shim)
  assert.equal(api.shim.logger.debug.callCount, 1, 'should call debug logger')
  assert.equal(api.shim.logger.debug.args[0][0], 'Not wrapping export, expected a function.')
  end()
})
