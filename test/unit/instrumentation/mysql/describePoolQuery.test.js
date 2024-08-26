/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const instrumentation = require('../../../../lib/instrumentation/mysql/mysql')

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

    const result = instrumentation.describePoolQuery(mockShim, null, null, mockArgs)
    assert.equal(result.stream, true)
    assert.equal(result.query, null)
    assert.equal(result.callback, 1)
    assert.equal(result.name, 'MySQL Pool#query')
    assert.equal(result.record, false)
    assert.ok(mockShim.logger.trace.calledWith('Recording pool query'))

    end()
  })
})
