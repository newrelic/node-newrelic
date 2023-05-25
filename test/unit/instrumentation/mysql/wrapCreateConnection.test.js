/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noPreserveCache()
const symbols = require('../../../../lib/symbols')

tap.test('wrapCreateConnection', (t) => {
  t.autoend()

  let mockShim
  let mockMysql
  let mockConnection
  let instrumentation

  t.beforeEach(() => {
    mockShim = {
      MYSQL: 'test-mysql',
      setDatastore: sinon.stub().returns(),
      wrapReturn: sinon.stub().returns(),
      logger: {
        debug: sinon.stub().returns()
      },
      isWrapped: sinon.stub().returns(),
      recordQuery: sinon.stub().returns()
    }

    mockMysql = {
      createConnection: sinon.stub().returns()
    }

    mockConnection = {
      query: sinon.stub().returns()
    }

    instrumentation = proxyquire('../../../../lib/instrumentation/mysql/mysql', {})
  })

  t.test('should wrap mysql.getConnection', (t) => {
    instrumentation.callbackInitialize(mockShim, mockMysql)
    t.ok(
      mockShim.wrapReturn.calledWith(mockMysql, 'createConnection'),
      'should have called wrapReturn for createConnection'
    )

    t.end()
  })

  t.test('should return early if wrapping symbol exists', (t) => {
    mockShim[symbols.unwrapConnection] = true

    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreateConnection = mockShim.wrapReturn.args[0][2]
    wrapCreateConnection(mockShim, null, null, mockConnection)

    t.notOk(instrumentation.wrapQueryable.called, 'wrapQueryable should not have been called')

    t.end()
  })

  t.test('should not set the symbols if wrapQueryable returns false', (t) => {
    mockShim.isWrapped.returns(true)

    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreateConnection = mockShim.wrapReturn.args[0][2]
    wrapCreateConnection(mockShim, null, null, mockConnection)

    t.notOk(mockConnection[symbols.storeDatabase], 'should not have set the storeDatabase symbol')
    t.notOk(mockShim[symbols.unwrapConnection], 'should not have set the unwrapConnection symbol')

    t.end()
  })

  t.test('should set the symbols if wrapQueryable is successful', (t) => {
    instrumentation.wrapQueryable = sinon.stub().returns(true)
    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreateConnection = mockShim.wrapReturn.args[0][2]
    wrapCreateConnection(mockShim, null, null, mockConnection)

    t.equal(mockConnection[symbols.storeDatabase], true, 'should have set the storeDatabase symbol')
    t.equal(mockShim[symbols.unwrapConnection], true, 'should have set the unwrapConnection symbol')

    t.end()
  })
})
