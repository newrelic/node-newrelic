/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const instrumentation = require('../../../../lib/instrumentation/mysql/mysql')
const symbols = require('../../../../lib/symbols')

tap.test('describeQuery', (t) => {
  t.autoend()

  t.test('should pull the configuration for the query segment', (t) => {
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
    t.match(result, {
      stream: true,
      query: 'SELECT * FROM foo',
      callback: 1,
      parameters: { host: 'example.com', port_path_or_id: '1234', database_name: 'my-db-name' },
      record: true
    })

    t.ok(mockShim.logger.trace.calledWith('Recording query'))
    t.ok(
      mockShim.logger.trace.calledWith(
        { query: true, callback: true, parameters: true },
        'Query segment descriptor'
      )
    )

    t.end()
  })
})
