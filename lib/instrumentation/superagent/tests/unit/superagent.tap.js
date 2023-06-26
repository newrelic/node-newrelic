/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const sinon = require('sinon')

tap.test('SuperAgent instrumentation', (t) => {
  const helper = utils.TestAgent.makeInstrumented()
  t.teardown(() => helper.unload())

  helper.registerInstrumentation({
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
  const mockAgent = new utils.TestAgent()
  const api = mockAgent.getAgentApi()
  api.shim.logger.debug = sinon.stub()
  const instrumentation = require('../../lib/instrumentation')
  const superagentMock = { foo: 'bar' }
  instrumentation(api.shim, superagentMock)
  t.equal(api.shim.logger.debug.callCount, 1, 'should call debug logger')
  t.equal(api.shim.logger.debug.args[0][0], 'Not wrapping export, expected a function.')
  t.end()
})
