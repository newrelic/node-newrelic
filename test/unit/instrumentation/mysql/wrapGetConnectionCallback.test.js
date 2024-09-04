/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const symbols = require('../../../../lib/symbols')

test('wrapGetConnectionCallback', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.mockCallback = sinon.stub().returns('foo')

    ctx.nr.mockShim = {
      logger: {
        debug: sinon.stub().returns()
      },
      isWrapped: sinon.stub().returns(),
      recordQuery: sinon.stub().returns()
    }

    ctx.nr.mockConnection = {
      query: sinon.stub().returns()
    }

    ctx.nr.instrumentation = proxyquire('../../../../lib/instrumentation/mysql/mysql', {})
  })

  await t.test('should not wrap if the callback received an error', (t, end) => {
    const { mockCallback, mockShim, instrumentation } = t.nr
    const wrappedGetConnectionCallback = instrumentation.wrapGetConnectionCallback(
      mockShim,
      mockCallback
    )

    const expectedError = new Error('whoops')
    wrappedGetConnectionCallback(expectedError)

    assert.ok(mockCallback.calledOnceWith(expectedError), 'should still have called the callback')
    assert.ok(!mockShim[symbols.wrappedPoolConnection], 'should not have added the symbol')
    end()
  })

  await t.test('should catch the error if wrapping the callback throws', (t, end) => {
    const { mockCallback, mockShim, mockConnection, instrumentation } = t.nr
    const expectedError = new Error('whoops')
    mockShim.isWrapped.throws(expectedError)
    const wrappedGetConnectionCallback = instrumentation.wrapGetConnectionCallback(
      mockShim,
      mockCallback
    )

    wrappedGetConnectionCallback(null, mockConnection)

    assert.ok(
      mockCallback.calledOnceWith(null, mockConnection),
      'should still have called the callback'
    )
    assert.ok(!mockShim[symbols.wrappedPoolConnection], 'should not have added the symbol')
    end()
  })

  await t.test('should assign a symbol if wrapping is successful', (t, end) => {
    const { mockCallback, mockShim, mockConnection, instrumentation } = t.nr
    const wrappedGetConnectionCallback = instrumentation.wrapGetConnectionCallback(
      mockShim,
      mockCallback
    )

    wrappedGetConnectionCallback(null, mockConnection)

    assert.ok(
      mockCallback.calledOnceWith(null, mockConnection),
      'should still have called the callback'
    )
    assert.ok(mockShim[symbols.wrappedPoolConnection], 'should have added the symbol')
    end()
  })
})
