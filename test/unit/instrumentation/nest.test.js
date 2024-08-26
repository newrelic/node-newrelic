/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const WebFrameworkShim = require('../../../lib/shim/webframework-shim')
const sinon = require('sinon')

function getMockModule() {
  class BaseExceptionFilter {}
  BaseExceptionFilter.prototype.handleUnknownError = sinon.stub()
  return { BaseExceptionFilter }
}

test('Nest unit.tests', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.initialize = require('../../../lib/instrumentation/@nestjs/core.js')
    ctx.nr.shim = new WebFrameworkShim(agent, 'nest')
    ctx.nr.mockCore = getMockModule()
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('Should record the error when in a transaction', (t, end) => {
    const { agent, initialize, mockCore, shim } = t.nr
    // Minimum Nest.js version supported.
    shim.pkgVersion = '8.0.0'
    initialize(agent, mockCore, '@nestjs/core', shim)

    helper.runInTransaction(agent, (tx) => {
      const err = new Error('something went wrong')
      const exceptionFilter = new mockCore.BaseExceptionFilter()
      assert.notEqual(
        shim.getOriginal(exceptionFilter.handleUnknownError),
        exceptionFilter.handleUnknownError,
        'wrapped and unwrapped handlers should not be equal'
      )

      exceptionFilter.handleUnknownError(err)
      tx.end()

      assert.equal(
        shim.getOriginal(exceptionFilter.handleUnknownError).callCount,
        1,
        'should have called the original error handler once'
      )

      const errors = agent.errors.traceAggregator.errors
      assert.equal(errors.length, 1, 'there should be one error')
      assert.equal(errors[0][2], 'something went wrong', 'should get the expected error')
      assert.ok(errors[0][4].stack_trace, 'should have the stack trace')

      end()
    })
  })

  await t.test('Should ignore the error when not in a transaction', (t, end) => {
    const { agent, initialize, mockCore, shim } = t.nr
    // Minimum Nest.js version supported.
    shim.pkgVersion = '8.0.0'
    initialize(agent, mockCore, '@nestjs/core', shim)

    const err = new Error('something went wrong')
    const exceptionFilter = new mockCore.BaseExceptionFilter()

    assert.notEqual(
      shim.getOriginal(exceptionFilter.handleUnknownError),
      exceptionFilter.handleUnknownError,
      'wrapped and unwrapped handlers should not be equal'
    )

    exceptionFilter.handleUnknownError(err)

    assert.equal(
      shim.getOriginal(exceptionFilter, 'handleUnknownError').callCount,
      1,
      'should have called the original error handler once'
    )
    const errors = agent.errors.traceAggregator.errors
    assert.equal(errors.length, 0, 'there should be no errors')

    end()
  })

  await t.test('Should not instrument versions earlier than 8.0.0', (t, end) => {
    const { agent, initialize, mockCore, shim } = t.nr
    // Unsupported version
    shim.pkgVersion = '7.4.0'
    initialize(agent, mockCore, '@nestjs/core', shim)

    const exceptionFilter = new mockCore.BaseExceptionFilter()
    assert.equal(
      shim.getOriginal(exceptionFilter.handleUnknownError),
      exceptionFilter.handleUnknownError,
      'wrapped and unwrapped handlers should be equal'
    )

    end()
  })
})
