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

test('mysql instrumentation', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}

    const mockMysql = {
      createConnection: sinon.stub().returns(),
      createPool: sinon.stub().returns(),
      createPoolCluster: sinon.stub().returns()
    }
    ctx.nr.mockShim = {
      MYSQL: 'test-mysql',
      setDatastore: sinon.stub().returns(),
      wrap: sinon.stub().returns(),
      wrapReturn: sinon.stub().returns(),
      isWrapped: sinon.stub().returns(),
      require: sinon.stub().returns(mockMysql)
    }

    ctx.nr.mockMysql = mockMysql
    ctx.nr.instrumentation = proxyquire('../../../../lib/instrumentation/mysql/mysql', {})
  })

  await t.test('callbackInitialize should set the datastore and symbols', (t, end) => {
    const { instrumentation, mockMysql, mockShim } = t.nr
    instrumentation.callbackInitialize(mockShim, mockMysql)

    assert.ok(mockShim.setDatastore.calledWith('test-mysql'), 'should set the datastore to mysql')
    assert.equal(
      mockShim[symbols.wrappedPoolConnection],
      false,
      'should default the wrappedPoolConnection symbol to false'
    )
    end()
  })

  await t.test('promiseInitialize should set the datastore and symbols', (t, end) => {
    const { instrumentation, mockMysql, mockShim } = t.nr
    instrumentation.promiseInitialize(mockShim, mockMysql)

    assert.ok(mockShim.setDatastore.calledWith('test-mysql'), 'should set the datastore to mysql')
    assert.equal(
      mockShim[symbols.wrappedPoolConnection],
      false,
      'should default the wrappedPoolConnection symbol to false'
    )
    end()
  })
})
