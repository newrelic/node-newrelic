/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const instrumentation = require('../../../../lib/instrumentation/mysql/mysql')
const symbols = require('../../../../lib/symbols')

tap.test('getInstanceParameters', (t) => {
  t.autoend()

  let mockShim
  let mockQueryable
  let mockQuery

  t.beforeEach(() => {
    mockShim = {
      logger: {
        trace: sinon.stub().returns()
      }
    }

    mockQueryable = {}

    mockQuery = 'SELECT * FROM foo'
  })

  t.test('should log if unable to find configuration to pull info', (t) => {
    const result = instrumentation.getInstanceParameters(mockShim, mockQueryable, mockQuery)

    t.same(
      result,
      { host: null, port_path_or_id: null, database_name: null, collection: null },
      'should return the default parameters'
    )
    t.ok(
      mockShim.logger.trace.calledWith('No query config detected, not collecting db instance data'),
      'should log'
    )

    t.end()
  })

  t.test('should favor connectionConfig over config', (t) => {
    mockQueryable = {
      config: {
        port: '1234',
        connectionConfig: {
          port: '5678'
        }
      }
    }

    const result = instrumentation.getInstanceParameters(mockShim, mockQueryable, mockQuery)
    t.equal(result.port_path_or_id, '5678')
    t.end()
  })

  t.test('should favor the symbol DB name over config', (t) => {
    mockQueryable = {
      config: {
        database: 'database-a'
      }
    }

    mockQueryable[symbols.databaseName] = 'database-b'

    const result = instrumentation.getInstanceParameters(mockShim, mockQueryable, mockQuery)
    t.equal(result.database_name, 'database-b')
    t.end()
  })

  t.test('should set the appropriate parameters for "normal" connections', (t) => {
    mockQueryable = {
      config: {
        database: 'test-database',
        host: 'example.com',
        port: '1234'
      }
    }

    const result = instrumentation.getInstanceParameters(mockShim, mockQueryable, mockQuery)
    t.same(result, {
      host: 'example.com',
      port_path_or_id: '1234',
      database_name: 'test-database',
      collection: null
    })
    t.end()
  })

  t.test('should set the appropriate parameters for unix socket connections', (t) => {
    mockQueryable = {
      config: {
        database: 'test-database',
        socketPath: '/var/run/mysqld/mysqld.sock'
      }
    }

    const result = instrumentation.getInstanceParameters(mockShim, mockQueryable, mockQuery)
    t.same(result, {
      host: 'localhost',
      port_path_or_id: '/var/run/mysqld/mysqld.sock',
      database_name: 'test-database',
      collection: null
    })
    t.end()
  })
})
