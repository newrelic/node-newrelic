/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const instrumentation = require('../../../../lib/instrumentation/mysql/mysql')
const symbols = require('../../../../lib/symbols')

tap.test('wrapGetConnection', (t) => {
  t.autoend()

  let mockShim
  let mockConnection

  t.beforeEach(() => {
    mockShim = {
      toArray: sinon.stub().returns(),
      isFunction: sinon.stub().returns(),
      isWrapped: sinon.stub().returns(),
      logger: {
        trace: sinon.stub().returns()
      },
      getSegment: sinon.stub().returns(),
      wrap: sinon.stub().returns(),
      bindSegment: sinon.stub().returns()
    }

    mockConnection = {}
  })

  t.test('should return false if Connection is undefined', (t) => {
    const result = instrumentation.wrapGetConnection(mockShim, undefined)

    t.equal(result, false)
    t.ok(
      mockShim.logger.trace.calledWith(
        { connectable: false, getConnection: false, isWrapped: false },
        'Not wrapping getConnection'
      )
    )

    t.end()
  })

  t.test('should return false if getConnection is undefined', (t) => {
    const result = instrumentation.wrapGetConnection(mockShim, mockConnection)

    t.equal(result, false)
    t.ok(
      mockShim.logger.trace.calledWith(
        { connectable: true, getConnection: false, isWrapped: false },
        'Not wrapping getConnection'
      )
    )

    t.end()
  })

  t.test('should return false if getConnection is already wrapped', (t) => {
    mockShim.isWrapped.returns(true)
    mockConnection.getConnection = sinon.stub().returns()
    const result = instrumentation.wrapGetConnection(mockShim, mockConnection)

    t.equal(result, false)
    t.ok(
      mockShim.logger.trace.calledWith(
        { connectable: true, getConnection: true, isWrapped: true },
        'Not wrapping getConnection'
      )
    )

    t.end()
  })

  t.test('should attempt to wrap the getConnection callback if it is not wrapped', (t) => {
    const mockCallback = sinon.stub().returns('lol')
    mockConnection.getConnection = sinon.stub().returns()
    mockShim.isWrapped.returns(false)
    mockShim.toArray.returns([null, mockCallback])
    mockShim.isFunction.returns(true)
    mockShim.wrap.returnsArg(1)

    const result = instrumentation.wrapGetConnection(mockShim, mockConnection)

    t.equal(result, true)
    t.ok(mockShim.wrap.calledWithMatch(Object.getPrototypeOf(mockConnection), 'getConnection'))

    const wrapper = mockShim.wrap.args[0][2]
    const callbackWrapper = wrapper(mockShim, mockCallback)
    callbackWrapper()

    t.equal(mockShim.wrap.callCount, 2)
    t.ok(
      mockShim.logger.trace.calledOnceWith({ hasSegment: false }, 'Wrapping callback with segment')
    )
    t.ok(mockShim.wrap.calledWith(mockCallback, instrumentation.wrapGetConnectionCallback))
    t.ok(mockShim.bindSegment.calledOnceWith(instrumentation.wrapGetConnectionCallback))

    t.end()
  })

  t.test('should not double wrap getConnection callback', (t) => {
    const mockCallback = sinon.stub().returns('lol')
    mockConnection.getConnection = sinon.stub().returns()
    mockShim[symbols.wrappedPoolConnection] = true
    mockShim.isWrapped.returns(false)
    mockShim.toArray.returns([null, mockCallback])
    mockShim.isFunction.returns(true)
    mockShim.wrap.returnsArg(1)

    const result = instrumentation.wrapGetConnection(mockShim, mockConnection)

    t.equal(result, true)
    t.ok(mockShim.wrap.calledWithMatch(Object.getPrototypeOf(mockConnection), 'getConnection'))

    const wrapper = mockShim.wrap.args[0][2]
    const callbackWrapper = wrapper(mockShim, mockCallback)
    callbackWrapper()

    t.equal(mockShim.wrap.callCount, 1)
    t.ok(mockShim.bindSegment.calledOnceWith(mockCallback))

    t.end()
  })
})
