/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')

const formatters = require('../../../lib/config/formatters')
test('config formatters', async () => {
  await test('array', async (t) => {
    await t.test('should trim string into array', () => {
      const val = 'opt1, opt2  ,   opt3 , opt4'
      const options = formatters.array(val)
      assert.deepStrictEqual(options, ['opt1', 'opt2', 'opt3', 'opt4'])
    })

    await t.test('should create an array with 1 element if no comma exists', () => {
      assert.deepStrictEqual(formatters.array('hello'), ['hello'])
    })
  })

  await test('int', async (t) => {
    await t.test('should parse number string as int', () => {
      assert.equal(formatters.int('100'), 100)
    })

    await t.test('should return isNaN is string is not a number', () => {
      assert.ok(isNaN(formatters.int('hello')))
    })

    await t.test('should parse float as int', () => {
      const values = ['1.01', 1.01]
      values.forEach((val) => {
        assert.equal(formatters.int(val), 1)
      })
    })
  })

  await test('float', async (t) => {
    await t.test('should parse number string as float', () => {
      assert.equal(formatters.float('100'), 100)
    })

    await t.test('should return isNaN is string is not a number', () => {
      assert.ok(isNaN(formatters.float('hello')))
    })

    await t.test('should parse float accordingly', () => {
      const values = ['1.01', 1.01]
      values.forEach((val) => {
        assert.equal(formatters.float(val), 1.01)
      })
    })
  })

  await test('boolean', async (t) => {
    const falseyValues = [null, 'false', 'f', 'no', 'n', 'disabled', '0']
    for (const val of falseyValues) {
      await t.test(`should map ${val} to false`, () => {
        assert.equal(formatters.boolean(val), false)
      })
    }

    // these are new tests but do not want to change behavior of this formatter
    // but anything that is not a falsey value above is true ¯\_(ツ)_/¯
    const truthyValues = ['true', 'anything-else', '[]', '{}']
    for (const val of truthyValues) {
      await t.test(`should map ${val} to true`, () => {
        assert.equal(formatters.boolean(val), true)
      })
    }
  })

  await test('object', async (t) => {
    await t.test('should parse json string as an object', () => {
      const val = '{"key": "value"}'
      const result = formatters.object(val)
      assert.deepStrictEqual(result, { key: 'value' })
    })

    await t.test('should log error and return null if it cannot parse option as json', () => {
      const loggerMock = { error: sinon.stub() }
      const val = 'invalid'
      assert.equal(formatters.object(val, loggerMock), null)
      assert.equal(
        loggerMock.error.args[0][0],
        'New Relic configurator could not deserialize object:'
      )
      assert.match(loggerMock.error.args[1][0], /SyntaxError: Unexpected token/)
    })
  })

  await test('objectList', async (t) => {
    await t.test('should parse json string a collection with 1 object', () => {
      const val = '{"key": "value"}'
      const result = formatters.objectList(val)
      assert.deepStrictEqual(result, [{ key: 'value' }])
    })

    await t.test('should log error and return null if it cannot parse option as json', () => {
      const loggerMock = { error: sinon.stub() }
      const val = 'invalid'
      assert.equal(formatters.objectList(val, loggerMock), null)
      assert.equal(
        loggerMock.error.args[0][0],
        'New Relic configurator could not deserialize object list:'
      )
      assert.match(loggerMock.error.args[1][0], /SyntaxError: Unexpected token/)
    })
  })

  await test('allowList', async (t) => {
    await t.test('should return value if in allow list', () => {
      const allowList = ['bad', 'good', 'evil']
      const val = 'good'
      const result = formatters.allowList(allowList, val)
      assert.deepStrictEqual(result, val)
    })

    await t.test('should return first element in allow list if value is not in list', () => {
      const allowList = ['good', 'bad', 'evil']
      const val = 'scary'
      const result = formatters.allowList(allowList, val)
      assert.deepStrictEqual(result, 'good')
    })
  })

  await test('regex', async (t) => {
    await t.test('should return regex if valid', () => {
      const val = '/hello/'
      const result = formatters.regex(val)
      assert.deepStrictEqual(result, /\/hello\//)
    })

    await t.test('should log error and return null if regex is invalid', () => {
      const loggerMock = { error: sinon.stub() }
      const val = '[a-z'
      assert.equal(formatters.regex(val, loggerMock), null)
      assert.equal(
        loggerMock.error.args[0][0],
        `New Relic configurator could not validate regex: [a-z`
      )
      assert.match(loggerMock.error.args[1][0], /SyntaxError: Invalid regular expression/)
    })
  })
})
