/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const deepEqual = require('../../lib/util/deep-equal')

test('deepEqual handles all the edge cases', function (t) {
  /*
   *
   * SUCCESS
   *
   */

  function functionA(a) {
    return a++
  }
  const functionB = functionA

  // 1. === gets the job done
  t.ok(deepEqual(null, null), 'null is the same as itself')
  t.ok(deepEqual(undefined, undefined), 'undefined is the same as itself')
  t.ok(deepEqual(0, 0), 'numbers check out')
  t.ok(deepEqual(1 / 0, 1 / 0), "it's a travesty that 1 / 0 = Infinity, but Infinities are equal")
  t.ok(deepEqual('ok', 'ok'), 'strings check out')
  t.ok(deepEqual(functionA, functionB), 'references to the same function are equal')

  // 4. buffers are compared by value
  const bufferA = Buffer.from('abc')
  let bufferB = Buffer.from('abc')
  t.ok(deepEqual(bufferA, bufferB), 'buffers are compared by value')

  // 5. dates are compared by numeric (time) value
  const dateA = new Date('2001-01-11')
  let dateB = new Date('2001-01-11')
  t.ok(deepEqual(dateA, dateB), 'dates are compared by time value')

  // 6. regexps are compared by their properties
  const rexpA = /^h[oe][wl][dl][oy]$/
  let rexpB = /^h[oe][wl][dl][oy]$/
  t.ok(deepEqual(rexpA, rexpB), 'regexps are compared by their properties')

  // 8. loads of tests for objects
  t.ok(deepEqual({}, {}), 'bare objects check out')
  const a = { a: 'a' }
  let b = a
  t.ok(deepEqual(a, b), 'identical object references check out')
  b = { a: 'a' }
  t.ok(deepEqual(a, b), 'identical simple object values check out')

  t.ok(deepEqual([0, 1], [0, 1]), 'arrays check out')

  const cyclicA = {}
  cyclicA.x = cyclicA
  const cyclicB = {}
  cyclicB.x = cyclicB
  t.ok(deepEqual(cyclicA, cyclicB), 'can handle cyclic data structures')

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
  t.ok(deepEqual(y, z), 'deeply recursive data structures also work')

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

  t.ok(deepEqual(heinous, awful), 'more complex objects also check out')

  awful.granular.self = heinous
  heinous.granular.self = awful
  t.ok(
    deepEqual(heinous, awful),
    'mutual recursion with otherwise identical structures fools deepEquals'
  )

  /*
   *
   * FAILURE
   *
   */

  // 1. === does its job
  t.notOk(deepEqual(NaN, NaN), 'NaN is the only JavaScript value not equal to itself')
  t.notOk(deepEqual(1 / 0, -1 / 0), 'opposite infinities are different')
  t.notOk(deepEqual(1, '1'), 'strict equality, no coercion between strings and numbers')
  t.notOk(deepEqual('ok', 'nok'), 'different strings are different')
  t.notOk(deepEqual(0, '0'), 'strict equality, no coercion between strings and numbers')
  t.notOk(deepEqual(undefined, null), 'so many kinds of nothingness!')
  t.notOk(
    deepEqual(
      function nop() {},
      function nop() {}
    ),
    'functions are only the same by reference'
  )

  // 2. one is an object, the other is not
  t.notOk(deepEqual(undefined, {}), "if both aren't objects, not the same")

  // 3. null is an object
  t.notOk(deepEqual({}, null), 'null is of type object')

  // 4. buffers are compared by both byte length (for speed) and value
  bufferB = Buffer.from('abcd')
  t.notOk(deepEqual(bufferA, bufferB), 'Buffers are checked for length')
  bufferB = Buffer.from('abd')
  t.notOk(deepEqual(bufferA, bufferB), 'Buffers are also checked for value')

  // 5. dates
  dateB = new Date('2001-01-12')
  t.notOk(deepEqual(dateA, dateB), 'different dates are not the same')

  // 6. regexps
  rexpB = /^(howdy|hello)$/
  t.notOk(deepEqual(rexpA, rexpB), 'different regexps are not the same')

  // 8. objects present edge cases galore
  t.notOk(deepEqual([], {}), "different object types shouldn't match")

  const nullstructor = Object.create(null)
  t.notOk(deepEqual({}, nullstructor), 'Object.create(null).constructor === undefined')

  b = { b: 'b' }
  t.notOk(deepEqual(a, b), "different object values aren't the same")

  awful.granular.stuff[2] = 3
  t.notOk(deepEqual(heinous, awful), 'small changes should be found')

  t.end()
})
