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

test('wrapQueryable', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.mockShim = {
      isWrapped: sinon.stub().returns(),
      logger: {
        debug: sinon.stub().returns()
      },
      recordQuery: sinon.stub().returns()
    }
  })

  await t.test('should return false if queryable definition is undefined', (t, end) => {
    const { mockShim } = t.nr
    const result = instrumentation.wrapQueryable(mockShim, undefined)
    assert.equal(result, false)
    assert.ok(
      mockShim.logger.debug.calledOnceWith(
        {
          queryable: false,
          query: false,
          isWrapped: false
        },
        'Not wrapping queryable'
      )
    )

    end()
  })

  await t.test('should return false if query function is missing', (t, end) => {
    const { mockShim } = t.nr
    const mockQueryable = {}
    const result = instrumentation.wrapQueryable(mockShim, mockQueryable)
    assert.equal(result, false)
    assert.ok(
      mockShim.logger.debug.calledOnceWith(
        {
          queryable: true,
          query: false,
          isWrapped: false
        },
        'Not wrapping queryable'
      )
    )

    end()
  })

  await t.test('should return false if query function is already wrapped', (t, end) => {
    const { mockShim } = t.nr
    const mockQueryable = {
      query: sinon.stub().returns()
    }
    mockShim.isWrapped.returns(true)
    const result = instrumentation.wrapQueryable(mockShim, mockQueryable)
    assert.equal(result, false)
    assert.ok(
      mockShim.logger.debug.calledOnceWith(
        {
          queryable: true,
          query: true,
          isWrapped: true
        },
        'Not wrapping queryable'
      )
    )

    end()
  })

  await t.test('should wrap query when using pooling', (t, end) => {
    const { mockShim } = t.nr
    const mockQueryable = {
      query: sinon.stub().returns()
    }

    const result = instrumentation.wrapQueryable(mockShim, mockQueryable, true)
    assert.equal(result, true)
    assert.equal(mockShim.logger.debug.callCount, 0)

    assert.ok(
      mockShim.recordQuery.calledOnceWith(
        Object.getPrototypeOf(mockQueryable),
        'query',
        instrumentation.describePoolQuery
      )
    )

    end()
  })

  await t.test('should wrap query', (t, end) => {
    const { mockShim } = t.nr
    const mockQueryable = {
      query: sinon.stub().returns()
    }

    const result = instrumentation.wrapQueryable(mockShim, mockQueryable)
    assert.equal(result, true)
    assert.equal(mockShim.logger.debug.callCount, 0)

    assert.ok(
      mockShim.recordQuery.calledOnceWith(
        Object.getPrototypeOf(mockQueryable),
        'query',
        instrumentation.describeQuery
      )
    )
    assert.equal(Object.getPrototypeOf(mockQueryable)[symbols.databaseName], null)

    end()
  })
  await t.test('should wrap execute if it is defined', (t, end) => {
    const { mockShim } = t.nr
    const mockQueryable = {
      query: sinon.stub().returns(),
      execute: sinon.stub().returns()
    }

    const result = instrumentation.wrapQueryable(mockShim, mockQueryable)
    assert.equal(result, true)
    assert.equal(mockShim.logger.debug.callCount, 0)

    assert.ok(
      mockShim.recordQuery.calledWith(
        Object.getPrototypeOf(mockQueryable),
        'execute',
        instrumentation.describeQuery
      )
    )

    end()
  })
})
