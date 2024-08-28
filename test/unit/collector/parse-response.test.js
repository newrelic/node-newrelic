/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const parse = require('../../../lib/collector/parse-response')

test('should call back with an error if called with no collector method name', (t, end) => {
  parse(null, { statusCode: 200 }, (error) => {
    assert.equal(error.message, 'collector method name required!')
    end()
  })
})

test('should call back with an error if called without a response', (t, end) => {
  parse('TEST', null, (error) => {
    assert.equal(error.message, 'HTTP response required!')
    end()
  })
})

test('should throw if called without a callback', () => {
  assert.throws(() => {
    parse('TEST', { statusCode: 200 }, undefined)
  }, /callback required!/)
})

test('when initialized properly and response status is 200', async (t) => {
  const response = { statusCode: 200 }
  const methodName = 'TEST'

  await t.test('should pass through return value', (t, end) => {
    const parser = parse(methodName, response, (error, res) => {
      assert.deepStrictEqual(res.payload, [1, 1, 2, 3, 5, 8])
      end()
    })
    parser(null, '{"return_value":[1,1,2,3,5,8]}')
  })

  await t.test('should pass through status code', (t, end) => {
    const parser = parse(methodName, response, (error, res) => {
      assert.deepStrictEqual(res.status, 200)
      end()
    })
    parser(null, '{"return_value":[1,1,2,3,5,8]}')
  })

  await t.test('should pass through even a null return value', (t, end) => {
    const parser = parse(methodName, response, (error, res) => {
      assert.equal(res.payload, null)
      end()
    })
    parser(null, '{"return_value":null}')
  })

  await t.test('should not error on an explicitly null return value', (t, end) => {
    const parser = parse(methodName, response, (error) => {
      assert.equal(error, undefined)
      end()
    })
    parser(null, '{"return_value":null}')
  })

  await t.test('should not error in normal situations', (t, end) => {
    const parser = parse(methodName, response, (error) => {
      assert.equal(error, undefined)
      end()
    })
    parser(null, '{"return_value":[1,1,2,3,5,8]}')
  })

  await t.test('should not erro on a missing body', (t, end) => {
    const parser = parse(methodName, response, (error) => {
      assert.equal(error, undefined)
      end()
    })
    parser(null, null)
  })

  await t.test('should not error on unparseable return value', (t, end) => {
    const parser = parse(methodName, response, (error, res) => {
      assert.equal(error, undefined)
      assert.equal(res.payload, undefined)
      assert.equal(res.status, 200)
      end()
    })
    parser(null, '<html><body>hi</body></html>')
  })

  await t.test('should not error on server exception with no error message', (t, end) => {
    const parser = parse(methodName, response, (error, res) => {
      assert.equal(error, undefined)
      assert.equal(res.payload, undefined)
      assert.equal(res.status, 200)
      end()
    })
    parser(null, '{"exception":{"error_type":"RuntimeError"}}')
  })

  await t.test('should pass back passed in errors before missing body errors', (t, end) => {
    const parser = parse(methodName, response, (error) => {
      assert.equal(error.message, 'oh no!')
      end()
    })
    parser(Error('oh no!'), null)
  })
})

test('when initialized properly and response status is 503', async (t) => {
  const response = { statusCode: 503 }
  const methodName = 'TEST'

  await t.test('should pass through return value despite weird status code', (t, end) => {
    const parser = parse(methodName, response, (error, res) => {
      assert.equal(error, undefined)
      assert.deepStrictEqual(res.payload, [1, 1, 2, 3, 5, 8])
      assert.equal(res.status, 503)
      end()
    })
    parser(null, '{"return_value":[1,1,2,3,5,8]}')
  })

  await t.test('should not error on no return value or server exception', (t, end) => {
    const parser = parse(methodName, response, (error, res) => {
      assert.equal(error, undefined)
      assert.deepStrictEqual(res.status, 503)
      end()
    })
    parser(null, '{}')
  })
})
