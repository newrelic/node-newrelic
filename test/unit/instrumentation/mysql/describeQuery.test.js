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

test('describeQuery', async (t) => {
  await t.test('should pull the configuration for the query segment', (t, end) => {
    const mockShim = {
      logger: {
        trace: sinon.stub().returns()
      },
      isString: sinon.stub().returns(true),
      isArray: sinon.stub().returns(false)
    }

    const mockArgs = ['SELECT * FROM foo', sinon.stub()]

    instrumentation[symbols.databaseName] = 'my-db-name'
    instrumentation.config = {
      host: 'example.com',
      port: '1234'
    }
    const result = instrumentation.describeQuery(mockShim, null, null, mockArgs)
    assert.equal(result.stream, true)
    assert.equal(result.query, 'SELECT * FROM foo')
    assert.equal(result.callback, 1)
    assert.deepEqual(result.parameters, {
      collection: null,
      host: 'example.com',
      port_path_or_id: '1234',
      database_name: 'my-db-name'
    })
    assert.equal(result.record, true)
    assert.ok(mockShim.logger.trace.calledWith('Recording query'))
    assert.ok(
      mockShim.logger.trace.calledWith(
        { query: true, callback: true, parameters: true },
        'Query segment descriptor'
      )
    )

    end()
  })
})
