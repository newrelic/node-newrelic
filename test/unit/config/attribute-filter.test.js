/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const AttributeFilter = require('../../../lib/config/attribute-filter')
const { makeAttributeFilterConfig } = require('../../lib/agent_helper')

const DESTS = AttributeFilter.DESTINATIONS

tap.test('#constructor', (t) => {
  t.autoend()

  t.test('should require a config object', (t) => {
    t.throws(function () {
      return new AttributeFilter()
    })

    t.doesNotThrow(function () {
      return new AttributeFilter(makeAttributeFilterConfig())
    })

    t.end()
  })
})

tap.test('#filter', (t) => {
  t.autoend()

  t.test('should respect the rules', (t) => {
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

    makeFilterAssertions(t, filter)

    t.end()
  })

  t.test('should not add include rules when they are disabled', (t) => {
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

    t.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'a'), DESTS.TRANS_COMMON)
    t.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'ab'), DESTS.NONE)
    t.equal(filter.filterTransaction(DESTS.TRANS_COMMON, ''), DESTS.TRANS_COMMON)
    t.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'b'), DESTS.TRANS_COMMON)
    t.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'bc'), DESTS.LIMITED)

    t.end()
  })

  t.test('should not matter the order of the rules', (t) => {
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

    makeFilterAssertions(t, filter)
    t.end()
  })

  t.test('should match `*` to anything', (t) => {
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

    t.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'a'), DESTS.TRANS_COMMON)
    t.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'ab'), DESTS.TRANS_COMMON)
    t.equal(filter.filterTransaction(DESTS.TRANS_COMMON, ''), DESTS.NONE)
    t.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'b'), DESTS.NONE)
    t.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'bc'), DESTS.NONE)

    t.end()
  })

  t.test('should parse dot rules correctly', (t) => {
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

    t.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'a.c'), DESTS.TRANS_COMMON)
    t.equal(filter.filterTransaction(DESTS.TRANS_COMMON, 'abc'), DESTS.NONE)

    t.equal(filter.filterTransaction(DESTS.NONE, 'a.c'), DESTS.TRANS_COMMON)
    t.equal(filter.filterTransaction(DESTS.NONE, 'abc'), DESTS.NONE)

    t.end()
  })
})

function makeFilterAssertions(t, filter) {
  // Filters down from global rules
  t.equal(filter.filterTransaction(DESTS.TRANS_SCOPE, 'a'), DESTS.TRANS_COMMON, 'a -> common')
  t.equal(filter.filterTransaction(DESTS.TRANS_SCOPE, 'ab'), DESTS.TRANS_EVENT, 'ab -> common')
  t.equal(filter.filterTransaction(DESTS.TRANS_SCOPE, 'abc'), DESTS.NONE, 'abc -> common')

  // Filters down from destination rules.
  t.equal(filter.filterTransaction(DESTS.TRANS_SCOPE, 'b'), DESTS.TRANS_COMMON, 'b -> common')
  t.equal(filter.filterTransaction(DESTS.TRANS_SCOPE, 'bc'), DESTS.LIMITED, 'bc -> common')
  t.equal(filter.filterTransaction(DESTS.TRANS_SCOPE, 'bcd'), DESTS.TRANS_COMMON, 'bcd -> common')
  t.equal(filter.filterTransaction(DESTS.TRANS_SCOPE, 'bcde'), DESTS.TRANS_COMMON, 'bcde -> common')

  // Adds destinations on top of defaults.
  t.equal(filter.filterTransaction(DESTS.NONE, 'a'), DESTS.TRANS_COMMON, 'a -> none')
  t.equal(filter.filterTransaction(DESTS.NONE, 'ab'), DESTS.TRANS_EVENT, 'ab -> none')
}
