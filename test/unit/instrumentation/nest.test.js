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
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('Should record the error when in a transaction', (t) => {
    // Minimum Nest.js version supported.
    shim.require = sinon.stub().returns({ version: '8.0.0' })
    initialize(agent, mockCore, '@nestjs/core', shim)

    helper.runInTransaction(agent, (tx) => {
      const err = new Error('something went wrong')
      const exceptionFilter = new mockCore.BaseExceptionFilter()
      t.not(
        shim.getOriginal(exceptionFilter.handleUnknownError),
        exceptionFilter.handleUnknownError,
        'wrapped and unwrapped handlers should not be equal'
      )

      exceptionFilter.handleUnknownError(err)
      tx.end()

      t.equal(
        shim.getOriginal(exceptionFilter.handleUnknownError).callCount,
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
    // Minimum Nest.js version supported.
    shim.require = sinon.stub().returns({ version: '8.0.0' })
    initialize(agent, mockCore, '@nestjs/core', shim)

    const err = new Error('something went wrong')
    const exceptionFilter = new mockCore.BaseExceptionFilter()

    t.not(
      shim.getOriginal(exceptionFilter.handleUnknownError),
      exceptionFilter.handleUnknownError,
      'wrapped and unwrapped handlers should not be equal'
    )

    exceptionFilter.handleUnknownError(err)

    t.equal(
      shim.getOriginal(exceptionFilter, 'handleUnknownError').callCount,
      1,
      'should have called the original error handler once'
    )
    const errors = agent.errors.traceAggregator.errors
    t.equal(errors.length, 0, 'there should be no errors')

    t.end()
  })

  t.test('Should not instrument versions earlier than 8.0.0', (t) => {
    // Unsupported version
    shim.require = sinon.stub().returns({ version: '7.4.0' })
    initialize(agent, mockCore, '@nestjs/core', shim)

    const exceptionFilter = new mockCore.BaseExceptionFilter()
    t.equal(
      shim.getOriginal(exceptionFilter.handleUnknownError),
      exceptionFilter.handleUnknownError,
      'wrapped and unwrapped handlers should be equal'
    )

    t.end()
  })
})
