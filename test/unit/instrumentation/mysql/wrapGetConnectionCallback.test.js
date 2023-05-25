/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const symbols = require('../../../../lib/symbols')

tap.test('wrapGetConnectionCallback', (t) => {
  t.autoend()

  let mockCallback
  let mockConnection
  let mockShim
  let instrumentation

  t.beforeEach(() => {
    mockCallback = sinon.stub().returns('foo')

    mockShim = {
      logger: {
        debug: sinon.stub().returns()
      },
      isWrapped: sinon.stub().returns(),
      recordQuery: sinon.stub().returns()
    }

    mockConnection = {
      query: sinon.stub().returns()
    }

    instrumentation = proxyquire('../../../../lib/instrumentation/mysql/mysql', {})
  })

  t.test('should not wrap if the callback received an error', (t) => {
    const wrappedGetConnectionCallback = instrumentation.wrapGetConnectionCallback(
      mockShim,
      mockCallback
    )

    const expectedError = new Error('whoops')
    wrappedGetConnectionCallback(expectedError)

    t.ok(mockCallback.calledOnceWith(expectedError), 'should still have called the callback')
    t.notOk(mockShim[symbols.wrappedPoolConnection], 'should not have added the symbol')
    t.end()
  })

  t.test('should catch the error if wrapping the callback throws', (t) => {
    const expectedError = new Error('whoops')
    mockShim.isWrapped.throws(expectedError)
    const wrappedGetConnectionCallback = instrumentation.wrapGetConnectionCallback(
      mockShim,
      mockCallback
    )

    wrappedGetConnectionCallback(null, mockConnection)

    t.ok(mockCallback.calledOnceWith(null, mockConnection), 'should still have called the callback')
    t.notOk(mockShim[symbols.wrappedPoolConnection], 'should not have added the symbol')
    t.end()
  })

  t.test('should assign a symbol if wrapping is successful', (t) => {
    const wrappedGetConnectionCallback = instrumentation.wrapGetConnectionCallback(
      mockShim,
      mockCallback
    )

    wrappedGetConnectionCallback(null, mockConnection)

    t.ok(mockCallback.calledOnceWith(null, mockConnection), 'should still have called the callback')
    t.ok(mockShim[symbols.wrappedPoolConnection], 'should have added the symbol')
    t.end()
  })
})
