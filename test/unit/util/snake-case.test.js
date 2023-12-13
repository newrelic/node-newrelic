/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const toSnakeCase = require('../../../lib/util/snake-case')

tap.test('toSnakeCase', (t) => {
  ;[
    { str: 'already_snake', expected: 'already_snake' },
    { str: 'myTestString', expected: 'my_test_string' },
    { str: '123AttrKey', expected: '123_attr_key' },
    { str: 'Foo-Bar', expected: 'foo_bar' }
  ].forEach(({ str, expected }) => {
    t.equal(toSnakeCase(str), expected, `should convert ${str} to ${expected}`)
  })
  t.end()
})
