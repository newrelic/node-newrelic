/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const hashes = require('../../../lib/util/hashes')

tap.test('hashes', (t) => {
  t.test('#makeId', (t) => {
    t.test('always returns the correct length', (t) => {
      for (let length = 4; length < 64; length++) {
        for (let attempts = 0; attempts < 500; attempts++) {
          const id = hashes.makeId(length)
          t.equal(id.length, length)
        }
      }
      t.end()
    })

    t.test('always unique', (t) => {
      const ids = {}
      for (let length = 16; length < 64; length++) {
        for (let attempts = 0; attempts < 500; attempts++) {
          const id = hashes.makeId(length)

          // Should be unique
          t.equal(ids[id], undefined)
          ids[id] = true

          // and the correct length
          t.equal(id.length, length)
        }
      }
      t.end()
    })
    t.end()
  })
  t.end()
})
