/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const symbols = require('../../../../lib/symbols')

tap.test('storeDatabaseName', (t) => {
  t.autoend()

  let mockDbUtils
  let instrumentation

  t.beforeEach(() => {
    mockDbUtils = {
      extractDatabaseChangeFromUse: sinon.stub()
    }
    instrumentation = proxyquire('../../../../lib/instrumentation/mysql/mysql', {
      '../../db/utils': mockDbUtils
    })
  })

  t.test('should do nothing if the storeDatabase symbol is missing', (t) => {
    const mockQueryable = {}
    const mockQuery = 'SELECT * FROM foo'

    instrumentation.storeDatabaseName(mockQueryable, mockQuery)

    t.equal(
      mockDbUtils.extractDatabaseChangeFromUse.callCount,
      0,
      'should not have tried to extract the name'
    )
    t.notOk(mockQueryable[symbols.databaseName])

    t.end()
  })

  t.test('should do nothing if unable to determine the name from the use statement', (t) => {
    const mockQueryable = {}
    mockQueryable[symbols.storeDatabase] = true
    const mockQuery = 'SELECT * FROM foo'

    instrumentation.storeDatabaseName(mockQueryable, mockQuery)

    t.ok(
      mockDbUtils.extractDatabaseChangeFromUse.calledWith(mockQuery),
      'should try to extract the name'
    )
    t.notOk(mockQueryable[symbols.databaseName])

    t.end()
  })

  t.test('should store the database name on a symbol', (t) => {
    const mockQueryable = {}
    mockQueryable[symbols.storeDatabase] = true
    const mockQuery = 'SELECT * FROM foo'

    mockDbUtils.extractDatabaseChangeFromUse.returns('mockDb')

    instrumentation.storeDatabaseName(mockQueryable, mockQuery)

    t.ok(
      mockDbUtils.extractDatabaseChangeFromUse.calledWith(mockQuery),
      'should try to extract the name'
    )
    t.equal(
      mockQueryable[symbols.databaseName],
      'mockDb',
      'should set the database name on the appropriate symbol'
    )

    t.end()
  })
})
