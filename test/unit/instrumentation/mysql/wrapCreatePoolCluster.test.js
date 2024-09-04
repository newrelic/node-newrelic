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

test('wrapCreatePoolCluster', async (t) => {
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
      wrap: sinon.stub().returns(),
      recordQuery: sinon.stub().returns()
    }

    ctx.nr.mockMysql = {
      createPoolCluster: sinon.stub().returns()
    }

    ctx.nr.mockPoolCluster = {
      of: sinon.stub().returns(),
      getConnection: sinon.stub().returns()
    }

    ctx.nr.mockNamespace = {
      query: sinon.stub().returns(),
      getConnection: sinon.stub().returns()
    }

    ctx.nr.instrumentation = proxyquire('../../../../lib/instrumentation/mysql/mysql', {})
  })

  await t.test('should wrap mysql.createPoolCluster', (t, end) => {
    const { mockShim, mockMysql, instrumentation } = t.nr
    instrumentation.callbackInitialize(mockShim, mockMysql)
    assert.ok(
      mockShim.wrapReturn.calledWith(mockMysql, 'createPoolCluster'),
      'should have called wrapReturn for createPoolCluster'
    )

    end()
  })

  await t.test('should return early if createPoolCluster symbol exists', (t, end) => {
    const { mockPoolCluster, mockShim, mockMysql, instrumentation } = t.nr
    mockShim[symbols.createPoolCluster] = true
    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreatePool = mockShim.wrapReturn.args[2][2]
    wrapCreatePool(mockShim, null, null, mockPoolCluster)
    assert.equal(
      instrumentation.wrapGetConnection.called,
      undefined,
      'wrapGetConnection should not have been called'
    )

    end()
  })

  await t.test(
    'should not set createPoolCluster symbol if wrapGetConnection returns false',
    (t, end) => {
      const { mockPoolCluster, mockShim, mockMysql, instrumentation } = t.nr
      mockShim.isWrapped.returns(true)
      instrumentation.callbackInitialize(mockShim, mockMysql)

      const wrapCreatePool = mockShim.wrapReturn.args[2][2]
      wrapCreatePool(mockShim, null, null, mockPoolCluster)
      assert.equal(
        mockShim[symbols.createPoolCluster],
        null,
        'should not have assigned the createPoolCluster symbol'
      )

      end()
    }
  )

  await t.test(
    'should set createPoolCluster symbol if wrapGetConnection returns true',
    (t, end) => {
      const { mockPoolCluster, mockShim, mockMysql, instrumentation } = t.nr
      instrumentation.callbackInitialize(mockShim, mockMysql)

      const wrapCreatePool = mockShim.wrapReturn.args[2][2]
      wrapCreatePool(mockShim, null, null, mockPoolCluster)
      assert.equal(
        mockShim[symbols.createPoolCluster],
        true,
        'should have assigned the createPoolCluster symbol'
      )

      end()
    }
  )

  await t.test('should return early if PoolCluster.of is already wrapped', (t, end) => {
    const { mockNamespace, mockPoolCluster, mockShim, mockMysql, instrumentation } = t.nr
    mockNamespace[symbols.clusterOf] = true

    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreatePool = mockShim.wrapReturn.args[2][2]
    wrapCreatePool(mockShim, null, null, mockPoolCluster)

    const wrapPoolClusterOf = mockShim.wrapReturn.args[3][2]
    wrapPoolClusterOf(mockShim, null, null, mockNamespace)

    assert.equal(
      mockShim.isWrapped.callCount,
      1,
      'should only have called isWrapped once for the PoolCluster.getConnection'
    )

    end()
  })

  await t.test('should not set the symbol if wrapGetConnection returns false', (t, end) => {
    const { mockNamespace, mockPoolCluster, mockShim, mockMysql, instrumentation } = t.nr
    mockShim.isWrapped.returns(true)
    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreatePool = mockShim.wrapReturn.args[2][2]
    wrapCreatePool(mockShim, null, null, mockPoolCluster)

    const wrapPoolClusterOf = mockShim.wrapReturn.args[3][2]
    wrapPoolClusterOf(mockShim, null, null, mockNamespace)

    assert.ok(!mockNamespace[symbols.clusterOf], 'should not have set the clusterOf symbol')

    end()
  })

  await t.test('should not set the symbol if wrapQueryable returns false', (t, end) => {
    const { mockNamespace, mockPoolCluster, mockShim, mockMysql, instrumentation } = t.nr
    mockShim.isWrapped.onCall(0).returns(false).returns(true)
    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreatePool = mockShim.wrapReturn.args[2][2]
    wrapCreatePool(mockShim, null, null, mockPoolCluster)

    const wrapPoolClusterOf = mockShim.wrapReturn.args[3][2]
    wrapPoolClusterOf(mockShim, null, null, mockNamespace)

    assert.ok(!mockNamespace[symbols.clusterOf], 'should not have set the clusterOf symbol')

    end()
  })

  await t.test('should wrap PoolCluster.of', (t, end) => {
    const { mockNamespace, mockPoolCluster, mockShim, mockMysql, instrumentation } = t.nr
    instrumentation.callbackInitialize(mockShim, mockMysql)

    const wrapCreatePool = mockShim.wrapReturn.args[2][2]
    wrapCreatePool(mockShim, null, null, mockPoolCluster)

    const wrapPoolClusterOf = mockShim.wrapReturn.args[3][2]
    wrapPoolClusterOf(mockShim, null, null, mockNamespace)

    assert.equal(mockNamespace[symbols.clusterOf], true, 'should have set the clusterOf symbol')

    end()
  })
})
