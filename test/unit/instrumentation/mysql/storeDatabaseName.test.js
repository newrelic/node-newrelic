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

test('storeDatabaseName', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const mockDbUtils = {
      extractDatabaseChangeFromUse: sinon.stub()
    }
    ctx.nr.instrumentation = proxyquire('../../../../lib/instrumentation/mysql/mysql', {
      '../../db/utils': mockDbUtils
    })
    ctx.nr.mockDbUtils = mockDbUtils
    ctx.nr.mockQuery = 'SELECT * FROM foo'
    ctx.nr.mockQueryable = {}
  })

  await t.test('should do nothing if the storeDatabase symbol is missing', (t, end) => {
    const { mockDbUtils, mockQuery, mockQueryable, instrumentation } = t.nr
    instrumentation.storeDatabaseName(mockQueryable, mockQuery)

    assert.equal(
      mockDbUtils.extractDatabaseChangeFromUse.callCount,
      0,
      'should not have tried to extract the name'
    )
    assert.ok(!mockQueryable[symbols.databaseName])

    end()
  })

  await t.test(
    'should do nothing if unable to determine the name from the use statement',
    (t, end) => {
      const { mockDbUtils, mockQuery, mockQueryable, instrumentation } = t.nr
      mockQueryable[symbols.storeDatabase] = true

      instrumentation.storeDatabaseName(mockQueryable, mockQuery)

      assert.ok(
        mockDbUtils.extractDatabaseChangeFromUse.calledWith(mockQuery),
        'should try to extract the name'
      )
      assert.ok(!mockQueryable[symbols.databaseName])

      end()
    }
  )

  await t.test('should store the database name on a symbol', (t, end) => {
    const { mockDbUtils, mockQuery, mockQueryable, instrumentation } = t.nr
    mockQueryable[symbols.storeDatabase] = true

    mockDbUtils.extractDatabaseChangeFromUse.returns('mockDb')

    instrumentation.storeDatabaseName(mockQueryable, mockQuery)

    assert.ok(
      mockDbUtils.extractDatabaseChangeFromUse.calledWith(mockQuery),
      'should try to extract the name'
    )
    assert.equal(
      mockQueryable[symbols.databaseName],
      'mockDb',
      'should set the database name on the appropriate symbol'
    )

    end()
  })
})
