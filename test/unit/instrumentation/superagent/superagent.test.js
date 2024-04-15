/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../../lib/agent_helper')
const sinon = require('sinon')

tap.beforeEach((t) => {
  t.context.agent = helper.loadMockedAgent()
})

tap.afterEach((t) => {
  helper.unloadAgent(t.context.agent)
})

tap.test('SuperAgent instrumentation', (t) => {
  helper.unloadAgent(t.context.agent)
  t.context.agent = helper.loadMockedAgent({
    moduleName: 'superagent',
    type: 'generic',
    onRequire: '../../lib/instrumentation'
  })
  const superagent = require('superagent')

  t.ok(superagent.Request, 'should not remove Request class')
  t.type(superagent.Request.prototype.then, 'function')
  t.type(superagent.Request.prototype.end, 'function')

  t.end()
})

tap.test('should not wrap superagent if it is not a function', (t) => {
  const api = helper.getAgentApi()
  api.shim.logger.debug = sinon.stub()
  const instrumentation = require('../../../../lib/instrumentation/superagent')
  const superagentMock = { foo: 'bar' }
  instrumentation(t.context.agent, superagentMock, 'superagent', api.shim)
  t.equal(api.shim.logger.debug.callCount, 1, 'should call debug logger')
  t.equal(api.shim.logger.debug.args[0][0], 'Not wrapping export, expected a function.')
  t.end()
})
