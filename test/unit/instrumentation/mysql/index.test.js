/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const symbols = require('../../../../lib/symbols')

tap.test('mysql instrumentation', (t) => {
  t.autoend()

  let mockShim
  let mockMysql
  let instrumentation

  t.beforeEach(() => {
    mockShim = {
      MYSQL: 'test-mysql',
      setDatastore: sinon.stub().returns(),
      wrapReturn: sinon.stub().returns(),
      isWrapped: sinon.stub().returns(),
      require: sinon.stub().returns(mockMysql)
    }

    mockMysql = {
      createConnection: sinon.stub().returns(),
      createPool: sinon.stub().returns(),
      createPoolCluster: sinon.stub().returns()
    }

    instrumentation = proxyquire('../../../../lib/instrumentation/mysql/mysql', {})
  })

  t.test('callbackInitialize should set the datastore and symbols', (t) => {
    instrumentation.callbackInitialize(mockShim, mockMysql)

    t.ok(mockShim.setDatastore.calledWith('test-mysql'), 'should set the datastore to mysql')
    t.equal(
      mockShim[symbols.wrappedPoolConnection],
      false,
      'should default the wrappedPoolConnection symbol to false'
    )
    t.end()
  })

  t.test(
    'promiseInitialize not should call callbackInitialized if createConnection is already wrapped',
    (t) => {
      instrumentation.callbackInitialize = sinon.stub().returns()
      mockShim.isWrapped.returns(true)
      instrumentation.promiseInitialize(mockShim, mockMysql)

      t.notOk(
        mockShim[symbols.wrappedPoolConnection],

        'should not have applied the symbol'
      )
      t.end()
    }
  )

  t.test('promiseInitialize should call callbackInitialized', (t) => {
    instrumentation.callbackInitialize = sinon.stub().returns()
    mockShim.isWrapped.returns(false)
    instrumentation.promiseInitialize(mockShim, mockMysql)

    t.ok(mockShim.setDatastore.calledWith('test-mysql'), 'should set the datastore to mysql')
    t.equal(
      mockShim[symbols.wrappedPoolConnection],
      false,
      'should default the wrappedPoolConnection symbol to false'
    )
    t.end()
  })
})
