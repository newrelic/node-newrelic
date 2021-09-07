/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')
const byteUtils = require('../../../lib/util/byte-limit')

test('byte-limit', (t) => {
  t.autoend()

  t.test('#isValidLength', (t) => {
    t.autoend()
    t.test('returns false when the string is larger than the limit', (t) => {
      t.notOk(byteUtils.isValidLength('12345', 4))
      t.end()
    })

    t.test('returns true when the string is equal to the limit', (t) => {
      t.ok(byteUtils.isValidLength('12345', 5))
      t.end()
    })

    t.test('returns true when the string is smaller than the limit', (t) => {
      t.ok(byteUtils.isValidLength('12345', 6))
      t.end()
    })
  })
  t.test('#compareLength', (t) => {
    t.autoend()
    t.test('returns -1 when the string is smaller than the limit', (t) => {
      const str = '123456789'
      const cmpVal = byteUtils.compareLength(str, 255)
      t.ok(cmpVal < 0)
      t.end()
    })
    t.test('returns 0 when the string is equal than the limit', (t) => {
      const str = '123456789'
      const cmpVal = byteUtils.compareLength(str, 9)
      t.equal(cmpVal, 0)
      t.end()
    })
    t.test('returns 1 when the string is larger than the limit', (t) => {
      const str = '123456789'
      const cmpVal = byteUtils.compareLength(str, 2)
      t.ok(cmpVal > 0)
      t.end()
    })
  })

  t.test('#truncate', (t) => {
    t.autoend()
    t.test('truncates string value to given limit', (t) => {
      let str = '123456789'
      str = byteUtils.truncate(str, 5)
      t.equal(str, '12345')
      t.end()
    })
    t.test('returns original string if within limit', (t) => {
      let str = '123456789'
      str = byteUtils.truncate(str, 10)
      t.equal(str, '123456789')
      t.end()
    })
    t.test('respects multibyte characters', (t) => {
      let str = '\uD87E\uDC04\uD87E\uDC04'
      t.equal(Buffer.byteLength(str, 'utf8'), 8)
      str = byteUtils.truncate(str, 3)
      t.equal(str, '\uD87E')
      t.end()
    })
    t.test('should strings with split unicode characters properly', (t) => {
      let str = '\uD87E\uDC04\uD87E\uDC04'
      t.equal(Buffer.byteLength(str, 'utf8'), 8)
      str = byteUtils.truncate(str, 2)
      t.equal(str, '')
      t.end()
    })
  })
})
