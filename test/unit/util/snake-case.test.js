/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('assert')
const test = require('node:test')
const toSnakeCase = require('../../../lib/util/snake-case')
const fixtures = [
  { str: 'already_snake', expected: 'already_snake' },
  { str: 'myTestString', expected: 'my_test_string' },
  { str: '123AttrKey', expected: '123_attr_key' },
  { str: 'Foo-Bar', expected: 'foo_bar' }
]

test('toSnakeCase', () => {
  fixtures.forEach(({ str, expected }) => {
    assert.equal(toSnakeCase(str), expected, `should convert ${str} to ${expected}`)
  })
})
