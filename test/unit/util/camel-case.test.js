/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const toCamelCase = require('../../../lib/util/camel-case')

test('toCamelCase', () => {
  ;[
    { str: 'snake_case', expected: 'snakeCase' },
    { str: 'myTestString', expected: 'myTestString' },
    { str: '123AttrKey', expected: '123AttrKey' },
    { str: 'X-Foo-Bar', expected: 'xFooBar' }
  ].forEach(({ str, expected }) => {
    assert.equal(toCamelCase(str), expected, `should convert ${str} to ${expected}`)
  })
})
