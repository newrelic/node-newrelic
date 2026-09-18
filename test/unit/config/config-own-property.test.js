/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const configOwnProperty = require('#agentlib/config/config-own-property.js')

test('configOwnProperty', async (t) => {
  await t.test('returns true for an own enumerable property', () => {
    assert.equal(configOwnProperty({ foo: 1 }, 'foo'), true)
  })

  await t.test('returns true for a property defined by a prototype getter', () => {
    const proto = {}
    Object.defineProperty(proto, 'viaGetter', { get() { return 1 } })
    const obj = Object.create(proto)
    assert.equal(configOwnProperty(obj, 'viaGetter'), true)
  })

  await t.test('returns true for a property defined by a prototype setter', () => {
    const proto = {}
    Object.defineProperty(proto, 'viaSetter', { set() {} })
    const obj = Object.create(proto)
    assert.equal(configOwnProperty(obj, 'viaSetter'), true)
  })

  await t.test('returns false for a property that is neither own nor a prototype accessor', () => {
    const proto = { plain: 1 }
    const obj = Object.create(proto)
    assert.equal(configOwnProperty(obj, 'missing'), false)
  })
})
