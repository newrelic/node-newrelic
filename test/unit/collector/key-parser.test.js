/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const parse = require('../../../lib/collector/key-parser').parseKey

tap.test('collector license key parser', (t) => {
  t.test('should return the region prefix when a region is detected', (t) => {
    const testKey = 'eu01xx66c637a29c3982469a3fe8d1982d002c4a'
    const region = parse(testKey)
    t.equal(region, 'eu01')
    t.end()
  })

  t.test('should return null when a region is not detected', (t) => {
    const testKey = '08a2ad66c637a29c3982469a3fe8d1982d002c4a'
    const region = parse(testKey)
    t.equal(region, null)
    t.end()
  })

  t.end()
})
