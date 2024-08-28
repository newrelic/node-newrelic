/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const AttributeFilter = require('../../../lib/config/attribute-filter')
const { makeAttributeFilterConfig } = require('../../lib/agent_helper')

const DESTS = AttributeFilter.DESTINATIONS

test('#constructor', async (t) => {
  await t.test('should require a config object', () => {
    assert.throws(function () {
      return new AttributeFilter()
    })

    assert.doesNotThrow(function () {
      return new AttributeFilter(makeAttributeFilterConfig())
    })
  })
})

test('#filter', async (t) => {
  await t.test('should respect the rules', () => {
    const filter = new AttributeFilter(
      makeAttributeFilterConfig({
        attributes: {
          enabled: true,
          include_enabled: true,
          include: ['a'],
          exclude: ['a*']
        },
        transaction_events: {
          attributes: {
            enabled: true,
            include: ['ab', 'bcd*', 'b*'],
            exclude: ['bc*']
          }
        }
      })
    )

    validateFilter(filter)
  })

  await t.test('should not add include rules when they are disabled', () => {
    const filter = new AttributeFilter(
      makeAttributeFilterConfig({
        attributes: {
          enabled: true,
          include_enabled: false,
          include: ['a'],
          exclude: ['ab']
        },
        transaction_events: {
          attributes: {
            enabled: true,
            include: ['ab', 'bcd*', 'b*'],
            exclude: ['bc*']
          }
        }
      })
    )

    assert.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'a'), DESTS.TRANS_COMMON)
    assert.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'ab'), DESTS.NONE)
    assert.equal(filter.filterTransaction(DESTS.TRANS_COMMON, ''), DESTS.TRANS_COMMON)
    assert.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'b'), DESTS.TRANS_COMMON)
    assert.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'bc'), DESTS.LIMITED)
  })

  await t.test('should not matter the order of the rules', () => {
    const filter = new AttributeFilter(
      makeAttributeFilterConfig({
        attributes: {
          enabled: true,
          include_enabled: true,
          include: ['a'],
          exclude: ['a*']
        },
        transaction_events: {
          attributes: {
            enabled: true,
            include: ['b*', 'bcd*', 'ab'],
            exclude: ['bc*']
          }
        }
      })
    )

    validateFilter(filter)
  })

  await t.test('should match `*` to anything', () => {
    const filter = new AttributeFilter(
      makeAttributeFilterConfig({
        attributes: {
          enabled: true,
          include_enabled: true,
          include: ['a*'],
          exclude: ['*']
        }
      })
    )

    assert.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'a'), DESTS.TRANS_COMMON)
    assert.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'ab'), DESTS.TRANS_COMMON)
    assert.equal(filter.filterTransaction(DESTS.TRANS_COMMON, ''), DESTS.NONE)
    assert.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'b'), DESTS.NONE)
    assert.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'bc'), DESTS.NONE)
  })

  await t.test('should parse dot rules correctly', () => {
    const filter = new AttributeFilter(
      makeAttributeFilterConfig({
        attributes: {
          enabled: true,
          include_enabled: true,
          include: ['a.c'],
          exclude: ['ab*']
        }
      })
    )

    assert.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'a.c'), DESTS.TRANS_COMMON)
    assert.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'abc'), DESTS.NONE)

    assert.equal(filter.filterTransaction(DESTS.NONE, 'a.c'), DESTS.TRANS_COMMON)
    assert.equal(filter.filterTransaction(DESTS.NONE, 'abc'), DESTS.NONE)
  })
})

function validateFilter(filter) {
  // Filters down from global rules
  assert.equal(filter.filterTransaction(DESTS.TRANS_SCOPE, 'a'), DESTS.TRANS_COMMON, 'a -> common')
  assert.equal(filter.filterTransaction(DESTS.TRANS_SCOPE, 'ab'), DESTS.TRANS_EVENT, 'ab -> common')
  assert.equal(filter.filterTransaction(DESTS.TRANS_SCOPE, 'abc'), DESTS.NONE, 'abc -> common')

  // Filters down from destination rules.
  assert.equal(filter.filterTransaction(DESTS.TRANS_SCOPE, 'b'), DESTS.TRANS_COMMON, 'b -> common')
  assert.equal(filter.filterTransaction(DESTS.TRANS_SCOPE, 'bc'), DESTS.LIMITED, 'bc -> common')
  assert.equal(
    filter.filterTransaction(DESTS.TRANS_SCOPE, 'bcd'),
    DESTS.TRANS_COMMON,
    'bcd -> common'
  )
  assert.equal(
    filter.filterTransaction(DESTS.TRANS_SCOPE, 'bcde'),
    DESTS.TRANS_COMMON,
    'bcde -> common'
  )

  // Adds destinations on top of defaults.
  assert.equal(filter.filterTransaction(DESTS.NONE, 'a'), DESTS.TRANS_COMMON, 'a -> none')
  assert.equal(filter.filterTransaction(DESTS.NONE, 'ab'), DESTS.TRANS_EVENT, 'ab -> none')
}
