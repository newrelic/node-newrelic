/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const parse = require('../../../lib/collector/parse-response')

tap.test('should call back with an error if called with no collector method name', (t) => {
  parse(null, {statusCode: 200}, (err) => {
    t.ok(err)
    t.equal(err.message, 'collector method name required!')

    t.end()
  })
})

tap.test('should call back with an error if called without a response', (t) => {
  parse('TEST', null, (err) => {
    t.ok(err)
    t.equal(err.message, 'HTTP response required!')

    t.end()
  })
})

tap.test('should throw if called without a callback', (t) => {
  const response = {statusCode : 200}
  t.throws(() => { parse('TEST', response, undefined) }, new Error('callback required!'))

  t.end()
})

tap.test('when initialized properly and response status is 200', (t) => {
  t.autoend()

  const response = {statusCode : 200}
  const methodName = 'TEST'

  t.test('should pass through return value', (t) => {
    function callback(error, res) {
      t.deepEqual(res.payload, [1,1,2,3,5,8])

      t.end()
    }

    const parser = parse(methodName, response, callback)
    parser(null, '{"return_value":[1,1,2,3,5,8]}')
  })

  t.test('should pass through status code', (t) => {
    function callback(error, res) {
      t.equal(res.status, 200)
      t.end()
    }

    const parser = parse(methodName, response, callback)
    parser(null, '{"return_value":[1,1,2,3,5,8]}')
  })

  t.test('should pass through even a null return value', (t) => {
    function callback(error, res) {
      t.equal(res.payload, null)
      t.end()
    }

    const parser = parse(methodName, response, callback)
    parser(null, '{"return_value":null}')
  })

  t.test('should not error on an explicitly null return value', (t) => {
    function callback(error) {
      t.error(error)
      t.end()
    }

    const parser = parse(methodName, response, callback)
    parser(null, '{"return_value":null}')
  })

  t.test('should not error in normal situations', (t) => {
    function callback(error) {
      t.error(error)
      t.end()
    }

    const parser = parse(methodName, response, callback)
    parser(null, '{"return_value":[1,1,2,3,5,8]}')
  })

  t.test('should not error on a missing body', (t) => {
    function callback(error, res) {
      t.error(error)
      t.equal(res.status, 200)
      t.end()
    }

    const parser = parse(methodName, response, callback)
    parser(null, null)
  })

  t.test('should not error on unparsable return value', (t) => {
    function callback(error, res) {
      t.error(error)

      t.notOk(res.payload)
      t.equal(res.status, 200)

      t.end()
    }

    const exception = '<html><body>hi</body></html>'

    const parser = parse(methodName, response, callback)
    parser(null, exception)
  })

  t.test('should not error on a server exception with no error message', (t) => {
    function callback(error, res) {
      t.error(error)

      t.notOk(res.payload)
      t.equal(res.status, 200)

      t.end()
    }

    const exception = '{"exception":{"error_type":"RuntimeError"}}'

    const parser = parse(methodName, response, callback)
    parser(null, exception)
  })

  t.test('should pass back passed in errors before missing body errors', (t) => {
    function callback(error) {
      t.ok(error)
      t.equal(error.message, 'oh no!')

      t.end()
    }

    const parser = parse(methodName, response, callback)
    parser(new Error('oh no!'), null)
  })
})

tap.test('when initialized properly and response status is 503', (t) => {
  t.autoend()

  const response = {statusCode : 503}
  const methodName = 'TEST'

  t.test('should pass through return value despite weird status code', (t) => {
    function callback(error, res) {
      t.error(error)

      t.deepEqual(res.payload, [1,1,2,3,5,8])
      t.equal(res.status, 503)

      t.end()
    }

    const parser = parse(methodName, response, callback)
    parser(null, '{"return_value":[1,1,2,3,5,8]}')
  })

  t.test('should not error on no return value or server exception', (t) => {
    function callback(error, res) {
      t.error(error)
      t.equal(res.status, 503)

      t.end()
    }

    const parser = parse(methodName, response, callback)
    parser(null, '{}')
  })
})

