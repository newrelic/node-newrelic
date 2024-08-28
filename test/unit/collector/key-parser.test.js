/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const parse = require('../../../lib/collector/key-parser').parseKey

test('collector license key parser', async (t) => {
  await t.test('should return the region prefix when a region is detected', () => {
    const testKey = 'eu01xx66c637a29c3982469a3fe8d1982d002c4a'
    const region = parse(testKey)
    assert.equal(region, 'eu01')
  })

  await t.test('should return null when a region is not defined', () => {
    const testKey = '08a2ad66c637a29c3982469a3fe8d1982d002c4a'
    const region = parse(testKey)
    assert.equal(region, null)
  })
})
