/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noPreserveCache()
const symbols = require('../../../../lib/symbols')

test('wrapCreatePool', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.mockShim = {
      MYSQL: 'test-mysql',
      setDatastore: sinon.stub().returns(),
      wrapReturn: sinon.stub().returns(),
      logger: {
        debug: sinon.stub().returns(),
        trace: sinon.stub().returns()
      },
      isWrapped: sinon.stub().returns(),
      recordQuery: sinon.stub().returns(),
      wrap: sinon.stub().returns()
    }

    ctx.nr.mockMysql = {
      createPool: sinon.stub().returns()
    }

    ctx.nr.mockPool = {
      getConnection: sinon.stub().returns(),
      query: sinon.stub().returns()
    }

    ctx.nr.instrumentation = proxyquire('../../../../lib/instrumentation/mysql/mysql', {})
  })

  await t.test('should wrap mysql.createPool', (t, end) => {
    const { mockShim, mockMysql, instrumentation } = t.nr
    instrumentation.callbackInitialize(mockShim, mockMysql)
    assert.ok(
      mockShim.wrapReturn.calledWith(mockMysql, 'createPool'),
      'should have called wrapReturn for createPool'
    )

    end()
  })

  await t.test('should return early if wrapping symbol exists', (t, end) => {
    const { mockPool, mockShim, mockMysql, instrumentation } = t.nr
    mockShim[symbols.unwrapPool] = true

    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreatePool = mockShim.wrapReturn.args[1][2]
    wrapCreatePool(mockShim, null, null, mockPool)

    assert.equal(mockShim.logger.trace.callCount, 0, 'should not have hit the trace logging')
    assert.equal(mockShim.logger.debug.callCount, 0, 'should not have hit the debug logging')

    end()
  })

  await t.test('should not set the symbol if wrapQueryable returns false', (t, end) => {
    const { mockPool, mockShim, mockMysql, instrumentation } = t.nr
    mockShim.isWrapped.returns(true)

    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreatePool = mockShim.wrapReturn.args[1][2]
    wrapCreatePool(mockShim, null, null, mockPool)

    assert.ok(!mockShim[symbols.unwrapPool], 'should not have set the unwrapPool symbol')

    end()
  })

  await t.test('should not set the symbol if wrapGetConnection returns false', (t, end) => {
    const { mockPool, mockShim, mockMysql, instrumentation } = t.nr
    mockShim.isWrapped.onCall(0).returns(false).returns(true)
    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreatePool = mockShim.wrapReturn.args[1][2]
    wrapCreatePool(mockShim, null, null, mockPool)

    assert.ok(!mockShim[symbols.unwrapPool], 'should not have set the unwrapPool symbol')

    end()
  })

  await t.test(
    'should set the symbols if wrapQueryable and wrapGetConnection is successful',
    (t, end) => {
      const { mockPool, mockShim, mockMysql, instrumentation } = t.nr
      instrumentation.callbackInitialize(mockShim, mockMysql)
      const wrapCreatePool = mockShim.wrapReturn.args[1][2]
      wrapCreatePool(mockShim, null, null, mockPool)

      assert.equal(mockShim[symbols.unwrapPool], true, 'should have set the unwrapPool symbol')

      end()
    }
  )
})
