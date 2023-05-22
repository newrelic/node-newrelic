/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const instrumentation = require('../../../../lib/instrumentation/mysql/mysql')
const symbols = require('../../../../lib/symbols')

tap.test('wrapQueryable', (t) => {
  t.autoend()

  let mockShim
  let mockQueryable

  t.beforeEach(() => {
    mockShim = {
      isWrapped: sinon.stub().returns(),
      logger: {
        debug: sinon.stub().returns()
      },
      recordQuery: sinon.stub().returns()
    }
  })

  t.test('should return false if queryable definition is undefined', (t) => {
    const result = instrumentation.wrapQueryable(mockShim, undefined)
    t.equal(result, false)
    t.ok(
      mockShim.logger.debug.calledOnceWith(
        {
          queryable: false,
          query: false,
          isWrapped: false
        },
        'Not wrapping queryable'
      )
    )

    t.end()
  })

  t.test('should return false if query function is missing', (t) => {
    mockQueryable = {}
    const result = instrumentation.wrapQueryable(mockShim, mockQueryable)
    t.equal(result, false)
    t.ok(
      mockShim.logger.debug.calledOnceWith(
        {
          queryable: true,
          query: false,
          isWrapped: false
        },
        'Not wrapping queryable'
      )
    )

    t.end()
  })

  t.test('should return false if query function is already wrapped', (t) => {
    mockQueryable = {
      query: sinon.stub().returns()
    }
    mockShim.isWrapped.returns(true)
    const result = instrumentation.wrapQueryable(mockShim, mockQueryable)
    t.equal(result, false)
    t.ok(
      mockShim.logger.debug.calledOnceWith(
        {
          queryable: true,
          query: true,
          isWrapped: true
        },
        'Not wrapping queryable'
      )
    )

    t.end()
  })

  t.test('should wrap query when using pooling', (t) => {
    mockQueryable = {
      query: sinon.stub().returns()
    }

    const result = instrumentation.wrapQueryable(mockShim, mockQueryable, true)
    t.equal(result, true)
    t.equal(mockShim.logger.debug.callCount, 0)

    t.ok(
      mockShim.recordQuery.calledOnceWith(
        Object.getPrototypeOf(mockQueryable),
        'query',
        instrumentation.describePoolQuery
      )
    )

    t.end()
  })

  t.test('should wrap query', (t) => {
    mockQueryable = {
      query: sinon.stub().returns()
    }

    const result = instrumentation.wrapQueryable(mockShim, mockQueryable)
    t.equal(result, true)
    t.equal(mockShim.logger.debug.callCount, 0)

    t.ok(
      mockShim.recordQuery.calledOnceWith(
        Object.getPrototypeOf(mockQueryable),
        'query',
        instrumentation.describeQuery
      )
    )
    t.equal(Object.getPrototypeOf(mockQueryable)[symbols.databaseName], null)

    t.end()
  })
  t.test('should wrap execute if it is defined', (t) => {
    mockQueryable = {
      query: sinon.stub().returns(),
      execute: sinon.stub().returns()
    }

    const result = instrumentation.wrapQueryable(mockShim, mockQueryable)
    t.equal(result, true)
    t.equal(mockShim.logger.debug.callCount, 0)

    t.ok(
      mockShim.recordQuery.calledWith(
        Object.getPrototypeOf(mockQueryable),
        'execute',
        instrumentation.describeQuery
      )
    )

    t.end()
  })
})
