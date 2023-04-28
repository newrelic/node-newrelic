/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')
const helper = require('../../lib/agent_helper')
const WebFrameworkShim = require('../../../lib/shim/webframework-shim')
const sinon = require('sinon')

test('Nest unit tests', (t) => {
  t.autoend()

  let agent = null
  let initialize = null
  let shim = null
  let mockCore = null

  function getMockModule() {
    class BaseExceptionFilter {}
    BaseExceptionFilter.prototype.handleUnknownError = sinon.stub()
    return { BaseExceptionFilter }
  }

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    initialize = require('../../../lib/instrumentation/@nestjs/core.js')
    shim = new WebFrameworkShim(agent, 'nest')
    mockCore = getMockModule()
    initialize(agent, mockCore, '@nestjs/core', shim)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('Should record the error when in a transaction', (t) => {
    helper.runInTransaction(agent, (tx) => {
      const err = new Error('something went wrong')
      const exceptionFilter = new mockCore.BaseExceptionFilter()
      exceptionFilter.handleUnknownError(err)
      tx.end()

      t.equal(
        shim.unwrap(exceptionFilter.handleUnknownError).callCount,
        1,
        'should have called the original error handler once'
      )

      const errors = agent.errors.traceAggregator.errors
      t.equal(errors.length, 1, 'there should be one error')
      t.equal(errors[0][2], 'something went wrong', 'should get the expected error')
      t.ok(errors[0][4].stack_trace, 'should have the stack trace')

      t.end()
    })
  })

  t.test('Should ignore the error when not in a transaction', (t) => {
    const err = new Error('something went wrong')
    const exceptionFilter = new mockCore.BaseExceptionFilter()
    exceptionFilter.handleUnknownError(err)

    t.equal(
      shim.unwrap(exceptionFilter.handleUnknownError).callCount,
      1,
      'should have called the original error handler once'
    )
    const errors = agent.errors.traceAggregator.errors
    t.equal(errors.length, 0, 'there should be no errors')

    t.end()
  })
})
