/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const instrumentation = require('../../../../lib/instrumentation/mysql/mysql')
const symbols = require('../../../../lib/symbols')

test('getInstanceParameters', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.mockShim = {
      logger: {
        trace: sinon.stub().returns()
      }
    }

    ctx.nr.mockQuery = 'SELECT * FROM foo'
  })

  await t.test('should log if unable to find configuration to pull info', (t, end) => {
    const { mockQuery, mockShim } = t.nr
    const mockQueryable = {}
    const result = instrumentation.getInstanceParameters(mockShim, mockQueryable, mockQuery)

    assert.deepEqual(
      result,
      { host: null, port_path_or_id: null, database_name: null, collection: null },
      'should return the default parameters'
    )
    assert.ok(
      mockShim.logger.trace.calledWith('No query config detected, not collecting db instance data'),
      'should log'
    )

    end()
  })

  await t.test('should favor connectionConfig over config', (t, end) => {
    const { mockQuery, mockShim } = t.nr
    const mockQueryable = {
      config: {
        port: '1234',
        connectionConfig: {
          port: '5678'
        }
      }
    }

    const result = instrumentation.getInstanceParameters(mockShim, mockQueryable, mockQuery)
    assert.equal(result.port_path_or_id, '5678')
    end()
  })

  await t.test('should favor the symbol DB name over config', (t, end) => {
    const { mockQuery, mockShim } = t.nr
    const mockQueryable = {
      config: {
        database: 'database-a'
      }
    }

    mockQueryable[symbols.databaseName] = 'database-b'

    const result = instrumentation.getInstanceParameters(mockShim, mockQueryable, mockQuery)
    assert.equal(result.database_name, 'database-b')
    end()
  })

  await t.test('should set the appropriate parameters for "normal" connections', (t, end) => {
    const { mockQuery, mockShim } = t.nr
    const mockQueryable = {
      config: {
        database: 'test-database',
        host: 'example.com',
        port: '1234'
      }
    }

    const result = instrumentation.getInstanceParameters(mockShim, mockQueryable, mockQuery)
    assert.deepEqual(result, {
      host: 'example.com',
      port_path_or_id: '1234',
      database_name: 'test-database',
      collection: null
    })
    end()
  })

  await t.test('should set the appropriate parameters for unix socket connections', (t, end) => {
    const { mockQuery, mockShim } = t.nr
    const mockQueryable = {
      config: {
        database: 'test-database',
        socketPath: '/var/run/mysqld/mysqld.sock'
      }
    }

    const result = instrumentation.getInstanceParameters(mockShim, mockQueryable, mockQuery)
    assert.deepEqual(result, {
      host: 'localhost',
      port_path_or_id: '/var/run/mysqld/mysqld.sock',
      database_name: 'test-database',
      collection: null
    })
    end()
  })
})
