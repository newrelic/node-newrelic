/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const instrumentation = require('../../../../lib/instrumentation/mysql/mysql')
const symbols = require('../../../../lib/symbols')

test('wrapGetConnection', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.mockShim = {
      toArray: sinon.stub().returns(),
      isFunction: sinon.stub().returns(),
      isWrapped: sinon.stub().returns(),
      logger: {
        trace: sinon.stub().returns()
      },
      getSegment: sinon.stub().returns(),
      wrap: sinon.stub().returns(),
      bindSegment: sinon.stub().returns(),
      getOriginalOnce: sinon.stub().returns()
    }

    ctx.nr.mockConnection = {}
  })

  await t.test('should return false if Connection is undefined', (t, end) => {
    const { mockShim } = t.nr
    const result = instrumentation.wrapGetConnection(mockShim, undefined)

    assert.equal(result, false)
    assert.ok(
      mockShim.logger.trace.calledWith(
        { connectable: false, getConnection: false, isWrapped: false },
        'Not wrapping getConnection'
      )
    )

    end()
  })

  await t.test('should return false if getConnection is undefined', (t, end) => {
    const { mockConnection, mockShim } = t.nr
    const result = instrumentation.wrapGetConnection(mockShim, mockConnection)

    assert.equal(result, false)
    assert.ok(
      mockShim.logger.trace.calledWith(
        { connectable: true, getConnection: false, isWrapped: false },
        'Not wrapping getConnection'
      )
    )

    end()
  })

  await t.test('should return false if getConnection is already wrapped', (t, end) => {
    const { mockConnection, mockShim } = t.nr
    mockShim.isWrapped.returns(true)
    mockConnection.getConnection = sinon.stub().returns()
    const result = instrumentation.wrapGetConnection(mockShim, mockConnection)

    assert.equal(result, false)
    assert.ok(
      mockShim.logger.trace.calledWith(
        { connectable: true, getConnection: true, isWrapped: true },
        'Not wrapping getConnection'
      )
    )

    end()
  })

  await t.test(
    'should attempt to wrap the getConnection callback if it is not wrapped',
    (t, end) => {
      const { mockConnection, mockShim } = t.nr
      const mockCallback = sinon.stub().returns('lol')
      mockConnection.getConnection = sinon.stub().returns()
      mockShim.isWrapped.returns(false)
      mockShim.toArray.returns([null, mockCallback])
      mockShim.isFunction.returns(true)
      mockShim.wrap.returnsArg(1)

      const result = instrumentation.wrapGetConnection(mockShim, mockConnection)

      assert.equal(result, true)
      assert.ok(
        mockShim.wrap.calledWithMatch(Object.getPrototypeOf(mockConnection), 'getConnection')
      )

      const wrapper = mockShim.wrap.args[0][2]
      const callbackWrapper = wrapper(mockShim, mockCallback)
      callbackWrapper()

      assert.equal(mockShim.wrap.callCount, 2)
      assert.ok(
        mockShim.logger.trace.calledOnceWith(
          { hasSegment: false },
          'Wrapping callback with segment'
        )
      )
      assert.ok(mockShim.wrap.calledWith(mockCallback, instrumentation.wrapGetConnectionCallback))
      assert.ok(mockShim.bindSegment.calledOnceWith(instrumentation.wrapGetConnectionCallback))

      end()
    }
  )

  await t.test('should not double wrap getConnection callback', (t, end) => {
    const { mockConnection, mockShim } = t.nr
    const mockCallback = sinon.stub().returns('lol')
    mockConnection.getConnection = sinon.stub().returns()
    mockShim[symbols.wrappedPoolConnection] = true
    mockShim.isWrapped.returns(false)
    mockShim.toArray.returns([null, mockCallback])
    mockShim.isFunction.returns(true)
    mockShim.wrap.returnsArg(1)

    const result = instrumentation.wrapGetConnection(mockShim, mockConnection)

    assert.equal(result, true)
    assert.ok(mockShim.wrap.calledWithMatch(Object.getPrototypeOf(mockConnection), 'getConnection'))

    const wrapper = mockShim.wrap.args[0][2]
    const callbackWrapper = wrapper(mockShim, mockCallback)
    callbackWrapper()

    assert.equal(mockShim.wrap.callCount, 1)
    assert.ok(mockShim.bindSegment.calledOnceWith(mockCallback))

    end()
  })
})
