/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noPreserveCache()
const symbols = require('../../../../lib/symbols')

tap.test('wrapCreatePool', (t) => {
  t.autoend()

  let mockShim
  let mockMysql
  let mockPool
  let instrumentation

  t.beforeEach(() => {
    mockShim = {
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

    mockMysql = {
      createPool: sinon.stub().returns()
    }

    mockPool = {
      getConnection: sinon.stub().returns(),
      query: sinon.stub().returns()
    }

    instrumentation = proxyquire('../../../../lib/instrumentation/mysql/mysql', {})
  })

  t.test('should wrap mysql.createPool', (t) => {
    instrumentation.callbackInitialize(mockShim, mockMysql)
    t.ok(
      mockShim.wrapReturn.calledWith(mockMysql, 'createPool'),
      'should have called wrapReturn for createPool'
    )

    t.end()
  })

  t.test('should return early if wrapping symbol exists', (t) => {
    mockShim[symbols.unwrapPool] = true

    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreatePool = mockShim.wrapReturn.args[1][2]
    wrapCreatePool(mockShim, null, null, mockPool)

    t.equal(mockShim.logger.trace.callCount, 0, 'should not have hit the trace logging')
    t.equal(mockShim.logger.debug.callCount, 0, 'should not have hit the debug logging')

    t.end()
  })

  t.test('should not set the symbol if wrapQueryable returns false', (t) => {
    mockShim.isWrapped.returns(true)

    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreatePool = mockShim.wrapReturn.args[1][2]
    wrapCreatePool(mockShim, null, null, mockPool)

    t.notOk(mockShim[symbols.unwrapPool], 'should not have set the unwrapPool symbol')

    t.end()
  })

  t.test('should not set the symbol if wrapGetConnection returns false', (t) => {
    mockShim.isWrapped.onCall(0).returns(false).returns(true)
    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreatePool = mockShim.wrapReturn.args[1][2]
    wrapCreatePool(mockShim, null, null, mockPool)

    t.notOk(mockShim[symbols.unwrapPool], 'should not have set the unwrapPool symbol')

    t.end()
  })

  t.test('should set the symbols if wrapQueryable and wrapGetConnection is successful', (t) => {
    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreatePool = mockShim.wrapReturn.args[1][2]
    wrapCreatePool(mockShim, null, null, mockPool)

    t.equal(mockShim[symbols.unwrapPool], true, 'should have set the unwrapPool symbol')

    t.end()
  })
})
