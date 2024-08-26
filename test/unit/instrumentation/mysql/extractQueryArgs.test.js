/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const instrumentation = require('../../../../lib/instrumentation/mysql/mysql')

test('extractQueryArgs', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.mockShim = {
      isString: sinon.stub().returns(),
      isArray: sinon.stub().returns()
    }
    ctx.nr.mockArgs = []
    ctx.nr.mockCallback = sinon.stub()
  })

  await t.test('should extract the query and callback when the first arg is a string', (t, end) => {
    const { mockArgs, mockShim, mockCallback } = t.nr
    mockShim.isString.returns(true)
    mockArgs.push('SELECT * FROM foo', mockCallback)

    const results = instrumentation.extractQueryArgs(mockShim, mockArgs)
    assert.deepEqual(results, { query: 'SELECT * FROM foo', callback: 1 })

    end()
  })

  await t.test(
    'should extract the query and callback when the first arg is an object property',
    (t, end) => {
      const { mockArgs, mockShim, mockCallback } = t.nr
      mockShim.isString.returns(false)
      mockShim.isArray.returns(true)

      mockArgs.push({ sql: 'SELECT * FROM foo' }, [], mockCallback)

      const results = instrumentation.extractQueryArgs(mockShim, mockArgs)
      assert.deepEqual(results, { query: 'SELECT * FROM foo', callback: 2 })

      end()
    }
  )
})
