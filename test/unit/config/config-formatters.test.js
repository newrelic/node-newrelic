/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')

const formatters = require('../../../lib/config/formatters')
tap.test('config formatters', (t) => {
  t.autoend()

  tap.test('array', (t) => {
    t.autoend()

    t.test('should trim string into array', (t) => {
      const val = 'opt1, opt2  ,   opt3 , opt4'
      const options = formatters.array(val)
      t.same(options, ['opt1', 'opt2', 'opt3', 'opt4'])
      t.end()
    })

    t.test('should create an array with 1 element if no comma exists', (t) => {
      t.same(formatters.array('hello'), ['hello'])
      t.end()
    })
  })

  tap.test('int', (t) => {
    t.autoend()

    t.test('should parse number string as int', (t) => {
      t.equal(formatters.int('100'), 100)
      t.end()
    })

    t.test('should return isNaN is string is not a number', (t) => {
      t.ok(isNaN(formatters.int('hello')))
      t.end()
    })

    t.test('should parse float as int', (t) => {
      const values = ['1.01', 1.01]
      values.forEach((val) => {
        t.equal(formatters.int(val), 1)
      })
      t.end()
    })
  })

  tap.test('float', (t) => {
    t.autoend()

    t.test('should parse number string as float', (t) => {
      t.equal(formatters.float('100'), 100)
      t.end()
    })

    t.test('should return isNaN is string is not a number', (t) => {
      t.ok(isNaN(formatters.float('hello')))
      t.end()
    })

    t.test('should parse float accordingly', (t) => {
      const values = ['1.01', 1.01]
      values.forEach((val) => {
        t.equal(formatters.float(val), 1.01)
      })
      t.end()
    })
  })

  tap.test('boolean', (t) => {
    t.autoend()

    const falseyValues = [null, 'false', 'f', 'no', 'n', 'disabled', '0']
    falseyValues.forEach((val) => {
      t.test(`should map ${val} to false`, (t) => {
        t.equal(formatters.boolean(val), false)
        t.end()
      })
    })

    // these are new tests but do not want to change behavior of this formatter
    // but anything that is not a falsey value above is true ¯\_(ツ)_/¯
    const truthyValues = ['true', 'anything-else', '[]', '{}']
    truthyValues.forEach((val) => {
      t.test(`should map ${val} to true`, (t) => {
        t.equal(formatters.boolean(val), true)
        t.end()
      })
    })
  })

  tap.test('object', (t) => {
    t.autoend()

    t.test('should parse json string as an object', (t) => {
      const val = '{"key": "value"}'
      const result = formatters.object(val)
      t.same(result, { key: 'value' })
      t.end()
    })

    t.test('should log error and return null if it cannot parse option as json', (t) => {
      const loggerMock = { error: sinon.stub() }
      const val = 'invalid'
      t.notOk(formatters.object(val, loggerMock))
      t.equal(loggerMock.error.args[0][0], 'New Relic configurator could not deserialize object:')
      t.match(loggerMock.error.args[1][0], /SyntaxError: Unexpected token/)
      t.end()
    })
  })

  tap.test('objectList', (t) => {
    t.autoend()

    t.test('should parse json string a collection with 1 object', (t) => {
      const val = '{"key": "value"}'
      const result = formatters.objectList(val)
      t.same(result, [{ key: 'value' }])
      t.end()
    })

    t.test('should log error and return null if it cannot parse option as json', (t) => {
      const loggerMock = { error: sinon.stub() }
      const val = 'invalid'
      t.notOk(formatters.objectList(val, loggerMock))
      t.equal(
        loggerMock.error.args[0][0],
        'New Relic configurator could not deserialize object list:'
      )
      t.match(loggerMock.error.args[1][0], /SyntaxError: Unexpected token/)
      t.end()
    })
  })

  tap.test('allowList', (t) => {
    t.autoend()

    t.test('should return value if in allow list', (t) => {
      const allowList = ['bad', 'good', 'evil']
      const val = 'good'
      const result = formatters.allowList(allowList, val)
      t.same(result, val)
      t.end()
    })

    t.test('should return first element in allow list if value is not in list', (t) => {
      const allowList = ['good', 'bad', 'evil']
      const val = 'scary'
      const result = formatters.allowList(allowList, val)
      t.same(result, 'good')
      t.end()
    })
  })

  tap.test('regex', (t) => {
    t.autoend()

    t.test('should return regex if valid', (t) => {
      const val = '/hello/'
      const result = formatters.regex(val)
      t.same(result, /\/hello\//)
      t.end()
    })

    t.test('should log error and return null if regex is invalid', (t) => {
      const loggerMock = { error: sinon.stub() }
      const val = '[a-z'
      t.notOk(formatters.regex(val, loggerMock))
      t.equal(loggerMock.error.args[0][0], `New Relic configurator could not validate regex: [a-z`)
      t.match(loggerMock.error.args[1][0], /SyntaxError: Invalid regular expression/)
      t.end()
    })
  })
})
