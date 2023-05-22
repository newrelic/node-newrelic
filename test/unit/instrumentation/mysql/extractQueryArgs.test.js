/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const instrumentation = require('../../../../lib/instrumentation/mysql/mysql')

tap.test('extractQueryArgs', (t) => {
  t.autoend()

  let mockShim
  let mockArgs
  let mockCallback

  t.beforeEach(() => {
    mockShim = {
      isString: sinon.stub().returns(),
      isArray: sinon.stub().returns()
    }

    mockArgs = []

    mockCallback = sinon.stub()
  })

  t.test('should extract the query and callback when the first arg is a string', (t) => {
    mockShim.isString.returns(true)
    mockArgs.push('SELECT * FROM foo', mockCallback)

    const results = instrumentation.extractQueryArgs(mockShim, mockArgs)
    t.same(results, { query: 'SELECT * FROM foo', callback: 1 })

    t.end()
  })

  t.test('should extract the query and callback when the first arg is an object property', (t) => {
    mockShim.isString.returns(false)
    mockShim.isArray.returns(true)

    mockArgs.push({ sql: 'SELECT * FROM foo' }, [], mockCallback)

    const results = instrumentation.extractQueryArgs(mockShim, mockArgs)
    t.same(results, { query: 'SELECT * FROM foo', callback: 2 })

    t.end()
  })
})
