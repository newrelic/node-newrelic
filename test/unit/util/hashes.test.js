/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const hashes = require('../../../lib/util/hashes')

test('hashes', async (t) => {
  await t.test('#makeId always returns the correct length', () => {
    for (let length = 4; length < 64; length++) {
      for (let attempts = 0; attempts < 500; attempts++) {
        const id = hashes.makeId(length)
        assert.equal(id.length, length)
      }
    }
  })

  await t.test('#makeId always unique', () => {
    const ids = {}
    for (let length = 16; length < 64; length++) {
      for (let attempts = 0; attempts < 500; attempts++) {
        const id = hashes.makeId(length)

        // Should be unique
        assert.equal(ids[id], undefined)
        ids[id] = true

        // and the correct length
        assert.equal(id.length, length)
      }
    }
  })
})
