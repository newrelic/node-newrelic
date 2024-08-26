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

test('wrapCreateConnection', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.mockShim = {
      MYSQL: 'test-mysql',
      setDatastore: sinon.stub().returns(),
      wrapReturn: sinon.stub().returns(),
      logger: {
        debug: sinon.stub().returns()
      },
      isWrapped: sinon.stub().returns(),
      recordQuery: sinon.stub().returns()
    }

    ctx.nr.mockMysql = {
      createConnection: sinon.stub().returns()
    }

    ctx.nr.mockConnection = {
      query: sinon.stub().returns()
    }

    ctx.nr.instrumentation = proxyquire('../../../../lib/instrumentation/mysql/mysql', {})
  })

  await t.test('should wrap mysql.getConnection', (t, end) => {
    const { mockShim, mockMysql, instrumentation } = t.nr
    instrumentation.callbackInitialize(mockShim, mockMysql)
    assert.ok(
      mockShim.wrapReturn.calledWith(mockMysql, 'createConnection'),
      'should have called wrapReturn for createConnection'
    )

    end()
  })

  await t.test('should return early if wrapping symbol exists', (t, end) => {
    const { mockConnection, mockShim, mockMysql, instrumentation } = t.nr
    mockShim[symbols.unwrapConnection] = true

    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreateConnection = mockShim.wrapReturn.args[0][2]
    wrapCreateConnection(mockShim, null, null, mockConnection)

    assert.ok(!instrumentation.wrapQueryable.called, 'wrapQueryable should not have been called')

    end()
  })

  await t.test('should not set the symbols if wrapQueryable returns false', (t, end) => {
    const { mockConnection, mockShim, mockMysql, instrumentation } = t.nr
    mockShim.isWrapped.returns(true)

    instrumentation.callbackInitialize(mockShim, mockMysql)
    const wrapCreateConnection = mockShim.wrapReturn.args[0][2]
    wrapCreateConnection(mockShim, null, null, mockConnection)

    assert.ok(
      !mockConnection[symbols.storeDatabase],
      'should not have set the storeDatabase symbol'
    )
    assert.ok(
      !mockShim[symbols.unwrapConnection],
      'should not have set the unwrapConnection symbol'
    )

    end()
  })

  await t.test('should set the symbols if wrapQueryable is successful', (t, end) => {
    const { mockConnection, mockShim, mockMysql, instrumentation } = t.nr
    instrumentation.wrapQueryable = sinon.stub().returns(true)
    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreateConnection = mockShim.wrapReturn.args[0][2]
    wrapCreateConnection(mockShim, null, null, mockConnection)

    assert.equal(
      mockConnection[symbols.storeDatabase],
      true,
      'should have set the storeDatabase symbol'
    )
    assert.equal(
      mockShim[symbols.unwrapConnection],
      true,
      'should have set the unwrapConnection symbol'
    )

    end()
  })
})
