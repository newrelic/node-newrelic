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
        debug: sinon.stub().returns()
      }
    }

    mockMysql = {
      createPool: sinon.stub().returns()
    }

    mockPool = {
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
    instrumentation.wrapQueryable = sinon.stub().returns(false)
    instrumentation.wrapGetConnection = sinon.stub().returns(false)
    mockShim[symbols.unwrapPool] = true

    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreatePool = mockShim.wrapReturn.args[1][2]
    wrapCreatePool(mockShim, null, null, mockPool)

    t.notOk(instrumentation.wrapQueryable.called, 'wrapQueryable should not have been called')
    t.notOk(
      instrumentation.wrapGetConnection.called,
      'wrapGetConnection should not have been called'
    )

    t.end()
  })

  t.test('should not set the symbol if wrapQueryable returns false', (t) => {
    instrumentation.wrapQueryable = sinon.stub().returns(false)
    instrumentation.wrapGetConnection = sinon.stub().returns(false)

    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreatePool = mockShim.wrapReturn.args[1][2]
    wrapCreatePool(mockShim, null, null, mockPool)

    t.ok(
      instrumentation.wrapQueryable.calledWith(mockShim, mockPool, true),
      'should have called wrapQueryable'
    )

    t.notOk(mockShim[symbols.unwrapPool], 'should not have set the unwrapPool symbol')

    t.end()
  })

  t.test('should not set the symbol if wrapGetConnection returns false', (t) => {
    instrumentation.wrapQueryable = sinon.stub().returns(true)
    instrumentation.wrapGetConnection = sinon.stub().returns(false)

    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreatePool = mockShim.wrapReturn.args[1][2]
    wrapCreatePool(mockShim, null, null, mockPool)

    t.ok(
      instrumentation.wrapQueryable.calledWith(mockShim, mockPool, true),
      'should have called wrapQueryable'
    )
    t.ok(
      instrumentation.wrapGetConnection.calledWith(mockShim, mockPool),
      'should have called wrapGetConnection'
    )

    t.notOk(mockShim[symbols.unwrapPool], 'should not have set the unwrapPool symbol')

    t.end()
  })

  t.test('should set the symbols if wrapQueryable and wrapGetConnection is successful', (t) => {
    instrumentation.wrapQueryable = sinon.stub().returns(true)
    instrumentation.wrapGetConnection = sinon.stub().returns(true)

    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreatePool = mockShim.wrapReturn.args[1][2]
    wrapCreatePool(mockShim, null, null, mockPool)

    t.ok(
      instrumentation.wrapQueryable.calledWith(mockShim, mockPool, true),
      'should have called wrapQueryable'
    )
    t.ok(
      instrumentation.wrapGetConnection.calledWith(mockShim, mockPool),
      'should have called wrapGetConnection'
    )

    t.equal(mockShim[symbols.unwrapPool], true, 'should have set the unwrapPool symbol')

    t.end()
  })
})
