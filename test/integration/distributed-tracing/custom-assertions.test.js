/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('node:test')
const { exact, expected, notEqual, unexpected } = require('./custom-assertions')

test('helper functions', () => {
  const objectExact = {
    foo: { bar: 'baz' },
    one: { two: 'three' }
  }
  exact(objectExact, { 'foo.bar': 'baz', 'one.two': 'three' })

  const objectExpected = {
    foo: { bar: 'baz' },
    one: { two: 'three' },
    science: false,
    science2: NaN
  }
  expected(objectExpected, ['foo.bar', 'one.two', 'science', 'science2'])

  const objectUnExpected = {
    foo: { bar: 'baz' },
    one: { two: 'three' },
    science: false,
    science2: NaN
  }
  unexpected(objectUnExpected, ['apple', 'orange'])

  const objectNotEqual = {
    foo: { bar: 'baz' },
    one: { two: 'three' }
  }
  notEqual(objectNotEqual, { 'foo.bar': 'bazz', 'one.two': 'threee' })
})
