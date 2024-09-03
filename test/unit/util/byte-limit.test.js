/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const byteUtils = require('../../../lib/util/byte-limit')

test('byte-limit', async (t) => {
  await t.test('#isValidLength', async (t) => {
    await t.test('returns false when the string is larger than the limit', () => {
      assert.ok(!byteUtils.isValidLength('12345', 4))
    })

    await t.test('returns true when the string is equal to the limit', () => {
      assert.ok(byteUtils.isValidLength('12345', 5))
    })

    await t.test('returns true when the string is smaller than the limit', () => {
      assert.ok(byteUtils.isValidLength('12345', 6))
    })
  })

  await t.test('#compareLength', async (t) => {
    await t.test('returns -1 when the string is smaller than the limit', () => {
      const str = '123456789'
      const cmpVal = byteUtils.compareLength(str, 255)
      assert.ok(cmpVal < 0)
    })
    await t.test('returns 0 when the string is equal than the limit', () => {
      const str = '123456789'
      const cmpVal = byteUtils.compareLength(str, 9)
      assert.equal(cmpVal, 0)
    })
    await t.test('returns 1 when the string is larger than the limit', () => {
      const str = '123456789'
      const cmpVal = byteUtils.compareLength(str, 2)
      assert.ok(cmpVal > 0)
    })
  })

  await t.test('#truncate', async (t) => {
    await t.test('truncates string value to given limit', () => {
      let str = '123456789'
      str = byteUtils.truncate(str, 5)
      assert.equal(str, '12345')
    })
    await t.test('returns original string if within limit', () => {
      let str = '123456789'
      str = byteUtils.truncate(str, 10)
      assert.equal(str, '123456789')
    })
    await t.test('respects multibyte characters', () => {
      let str = '\uD87E\uDC04\uD87E\uDC04'
      assert.equal(Buffer.byteLength(str, 'utf8'), 8)
      str = byteUtils.truncate(str, 3)
      assert.equal(str, '\uD87E')
    })
    await t.test('should strings with split unicode characters properly', () => {
      let str = '\uD87E\uDC04\uD87E\uDC04'
      assert.equal(Buffer.byteLength(str, 'utf8'), 8)
      str = byteUtils.truncate(str, 2)
      assert.equal(str, '')
    })
  })
})
