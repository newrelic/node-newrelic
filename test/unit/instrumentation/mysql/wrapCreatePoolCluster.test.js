/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noPreserveCache()
const symbols = require('../../../../lib/symbols')

tap.test('wrapCreatePoolCluster', (t) => {
  t.autoend()

  let mockShim
  let mockMysql
  let mockPoolCluster
  let mockNamespace
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
      wrap: sinon.stub().returns(),
      recordQuery: sinon.stub().returns()
    }

    mockMysql = {
      createPoolCluster: sinon.stub().returns()
    }

    mockPoolCluster = {
      of: sinon.stub().returns(),
      getConnection: sinon.stub().returns()
    }

    mockNamespace = {
      query: sinon.stub().returns(),
      getConnection: sinon.stub().returns()
    }

    instrumentation = proxyquire('../../../../lib/instrumentation/mysql/mysql', {})
  })

  t.test('should wrap mysql.createPoolCluster', (t) => {
    instrumentation.callbackInitialize(mockShim, mockMysql)
    t.ok(
      mockShim.wrapReturn.calledWith(mockMysql, 'createPoolCluster'),
      'should have called wrapReturn for createPoolCluster'
    )

    t.end()
  })

  t.test('should return early if createPoolCluster symbol exists', (t) => {
    mockShim[symbols.createPoolCluster] = true
    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreatePool = mockShim.wrapReturn.args[2][2]
    wrapCreatePool(mockShim, null, null, mockPoolCluster)
    t.notOk(
      instrumentation.wrapGetConnection.called,
      'wrapGetConnection should not have been called'
    )

    t.end()
  })

  t.test('should not set createPoolCluster symbol if wrapGetConnection returns false', (t) => {
    mockShim.isWrapped.returns(true)
    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreatePool = mockShim.wrapReturn.args[2][2]
    wrapCreatePool(mockShim, null, null, mockPoolCluster)
    t.notOk(
      mockShim[symbols.createPoolCluster],
      'should not have assigned the createPoolCluster symbol'
    )

    t.end()
  })

  t.test('should set createPoolCluster symbol if wrapGetConnection returns true', (t) => {
    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreatePool = mockShim.wrapReturn.args[2][2]
    wrapCreatePool(mockShim, null, null, mockPoolCluster)
    t.equal(
      mockShim[symbols.createPoolCluster],
      true,
      'should have assigned the createPoolCluster symbol'
    )

    t.end()
  })

  t.test('should return early if PoolCluster.of is already wrapped', (t) => {
    mockNamespace[symbols.clusterOf] = true

    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreatePool = mockShim.wrapReturn.args[2][2]
    wrapCreatePool(mockShim, null, null, mockPoolCluster)

    const wrapPoolClusterOf = mockShim.wrapReturn.args[3][2]
    wrapPoolClusterOf(mockShim, null, null, mockNamespace)

    t.equal(
      mockShim.isWrapped.callCount,
      1,
      'should only have called isWrapped once for the PoolCluster.getConnection'
    )

    t.end()
  })

  t.test('should not set the symbol if wrapGetConnection returns false', (t) => {
    mockShim.isWrapped.returns(true)
    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreatePool = mockShim.wrapReturn.args[2][2]
    wrapCreatePool(mockShim, null, null, mockPoolCluster)

    const wrapPoolClusterOf = mockShim.wrapReturn.args[3][2]
    wrapPoolClusterOf(mockShim, null, null, mockNamespace)

    t.notOk(mockNamespace[symbols.clusterOf], 'should not have set the clusterOf symbol')

    t.end()
  })

  t.test('should not set the symbol if wrapQueryable returns false', (t) => {
    mockShim.isWrapped.onCall(0).returns(false).returns(true)
    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreatePool = mockShim.wrapReturn.args[2][2]
    wrapCreatePool(mockShim, null, null, mockPoolCluster)

    const wrapPoolClusterOf = mockShim.wrapReturn.args[3][2]
    wrapPoolClusterOf(mockShim, null, null, mockNamespace)

    t.notOk(mockNamespace[symbols.clusterOf], 'should not have set the clusterOf symbol')

    t.end()
  })

  t.test('should wrap PoolCluster.of', (t) => {
    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreatePool = mockShim.wrapReturn.args[2][2]
    wrapCreatePool(mockShim, null, null, mockPoolCluster)

    const wrapPoolClusterOf = mockShim.wrapReturn.args[3][2]
    wrapPoolClusterOf(mockShim, null, null, mockNamespace)

    t.equal(mockNamespace[symbols.clusterOf], true, 'should have set the clusterOf symbol')

    t.end()
  })
})
