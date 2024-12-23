/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const deepEqual = require('../../../lib/util/deep-equal')

function functionA(a) {
  a = a + 1
  return a
}

test('deepEqual handles all the edge cases', async function (t) {
  await t.test('gets the job done', () => {
    const functionB = functionA

    assert.ok(deepEqual(null, null), 'null is the same as itself')
    assert.ok(deepEqual(undefined, undefined), 'undefined is the same as itself')
    assert.ok(deepEqual(0, 0), 'numbers check out')
    assert.ok(
      deepEqual(1 / 0, 1 / 0),
      "it's a travesty that 1 / 0 = Infinity, but Infinities are equal"
    )
    assert.ok(deepEqual('ok', 'ok'), 'strings check out')
    assert.ok(deepEqual(functionA, functionB), 'references to the same function are equal')
  })

  await t.test('buffers are compared by value', () => {
    const bufferA = Buffer.from('abc')
    const bufferB = Buffer.from('abc')
    assert.ok(deepEqual(bufferA, bufferB), 'buffers are compared by value')
  })

  await t.test('dates are compared by numeric(time) value', () => {
    const dateA = new Date('2001-01-11')
    const dateB = new Date('2001-01-11')
    assert.ok(deepEqual(dateA, dateB), 'dates are compared by time value')
  })

  await t.test('regexps are compared by their properties', () => {
    const rexpA = /^h[oe][wl][dl][oy]$/
    const rexpB = /^h[oe][wl][dl][oy]$/
    assert.ok(deepEqual(rexpA, rexpB), 'regexps are compared by their properties')
  })

  await t.test('loads of tests for objects', () => {
    assert.ok(deepEqual({}, {}), 'bare objects check out')
    const a = { a: 'a' }
    let b = a
    assert.ok(deepEqual(a, b), 'identical object references check out')
    b = { a: 'a' }
    assert.ok(deepEqual(a, b), 'identical simple object values check out')

    assert.ok(deepEqual([0, 1], [0, 1]), 'arrays check out')

    const cyclicA = {}
    cyclicA.x = cyclicA

    const cyclicB = {}
    cyclicB.x = cyclicB

    assert.ok(deepEqual(cyclicA, cyclicB), 'can handle cyclic data structures')

    const y = {
      v: {
        v: {
          v: { v: { v: { v: { v: { v: { v: { v: { v: { v: { v: { v: { v: {} } } } } } } } } } } } }
        }
      }
    }
    y.v.v.v.v.v.v.v.v.v.v.v.v.v.v.v.v = y
    const z = {
      v: {
        v: {
          v: { v: { v: { v: { v: { v: { v: { v: { v: { v: { v: { v: { v: {} } } } } } } } } } } } }
        }
      }
    }
    z.v.v.v.v.v.v.v.v.v.v.v.v.v.v.v.v = z
    assert.ok(deepEqual(y, z), 'deeply recursive data structures also work')

    const heinous = {
      nothin: null,
      nope: undefined,
      number: 0,
      funky: functionA,
      stringer: 'heya',
      then: new Date('1981-03-30'),
      rexpy: /^(pi|π)$/,
      granular: {
        stuff: [0, 1, 2]
      }
    }
    heinous.granular.self = heinous

    const awful = {
      nothin: null,
      nope: undefined,
      number: 0,
      funky: functionA,
      stringer: 'heya',
      then: new Date('1981-03-30'),
      rexpy: /^(pi|π)$/,
      granular: {
        stuff: [0, 1, 2]
      }
    }
    awful.granular.self = heinous

    assert.ok(deepEqual(heinous, awful), 'more complex objects also check out')

    awful.granular.self = heinous
    heinous.granular.self = awful
    assert.ok(
      deepEqual(heinous, awful),
      'mutual recursion with otherwise identical structures fools deepEquals'
    )
  })

  await t.test('comparisons are not matched', () => {
    assert.ok(!deepEqual(NaN, NaN), 'NaN is the only JavaScript value not equal to itself')
    assert.ok(!deepEqual(1 / 0, -1 / 0), 'opposite infinities are different')
    assert.ok(!deepEqual(1, '1'), 'strict equality, no coercion between strings and numbers')
    assert.ok(!deepEqual('ok', 'nok'), 'different strings are different')
    assert.ok(!deepEqual(0, '0'), 'strict equality, no coercion between strings and numbers')
    assert.ok(!deepEqual(undefined, null), 'so many kinds of nothingness!')
    assert.ok(
      !deepEqual(
        function nop() {},
        function nop() {}
      ),
      'functions are only the same by reference'
    )
  })

  await t.test('one is an object, the other is not', () => {
    assert.ok(!deepEqual(undefined, {}), "if both aren't objects, not the same")
  })

  await t.test('null is an object', () => {
    assert.ok(!deepEqual({}, null), 'null is of type object')
  })

  await t.test('buffers are compared by both byte length (for speed) and value', () => {
    const bufferA = Buffer.from('abc')
    const bufferB = Buffer.from('abcd')
    assert.ok(!deepEqual(bufferA, bufferB), 'Buffers are checked for length')
    const bufferC = Buffer.from('abd')
    assert.ok(!deepEqual(bufferA, bufferC), 'Buffers are also checked for value')
  })

  await t.test('dates', () => {
    const dateA = new Date('2001-01-11')
    const dateB = new Date('2001-01-12')
    assert.ok(!deepEqual(dateA, dateB), 'different dates are not the same')
  })

  await t.test('regexps', () => {
    const rexpA = /^h[oe][wl][dl][oy]$/
    const rexpB = /^(howdy|hello)$/
    assert.ok(!deepEqual(rexpA, rexpB), 'different regexps are not the same')
  })

  await t.test('objects present edge cases galore', () => {
    assert.ok(!deepEqual([], {}), "different object types shouldn't match")

    const nullstructor = Object.create(null)
    assert.ok(!deepEqual({}, nullstructor), 'Object.create(null).constructor === undefined')

    const a = { a: 'a' }
    const b = { b: 'b' }
    assert.ok(!deepEqual(a, b), "different object values aren't the same")

    const heinous = {
      nothin: null,
      nope: undefined,
      number: 0,
      funky: functionA,
      stringer: 'heya',
      then: new Date('1981-03-30'),
      rexpy: /^(pi|π)$/,
      granular: {
        stuff: [0, 1, 2]
      }
    }
    const awful = {
      nothin: null,
      nope: undefined,
      number: 0,
      funky: functionA,
      stringer: 'heya',
      then: new Date('1981-03-30'),
      rexpy: /^(pi|π)$/,
      granular: {
        stuff: [0, 1, 3]
      }
    }
    assert.ok(!deepEqual(heinous, awful), 'small changes should be found')
  })
})
