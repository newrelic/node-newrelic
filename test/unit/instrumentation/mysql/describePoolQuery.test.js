/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const instrumentation = require('../../../../lib/instrumentation/mysql/mysql')

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

    const result = instrumentation.describePoolQuery(mockShim, null, null, mockArgs)
    t.match(result, {
      stream: true,
      query: null,
      callback: 1,
      name: 'MySQL Pool#query',
      record: false
    })

    t.ok(mockShim.logger.trace.calledWith('Recording pool query'))

    t.end()
  })
})
