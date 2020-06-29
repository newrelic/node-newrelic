/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const AttributeFilter = require('../../../lib/config/attribute-filter')
const {makeAttributeFilterConfig} = require('../../lib/agent_helper')
const {expect} = require('chai')

const DESTS = AttributeFilter.DESTINATIONS

describe('AttributeFilter', function() {
  describe('constructor', function() {
    it('should require a config object', function() {
      expect(function() {
        return new AttributeFilter()
      }).to.throw()

      expect(function() {
        return new AttributeFilter(makeAttributeFilterConfig())
      }).to.not.throw()
    })
  })

  describe('#filter', function() {
    it('should respect the rules', function() {
      var filter = new AttributeFilter(makeAttributeFilterConfig({
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
      }))

      makeAssertions(filter)
    })

    it('should not add include rules when they are disabled', function() {
      var filter = new AttributeFilter(makeAttributeFilterConfig({
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
      }))

      expect(filter.filterTransaction(DESTS.TRANS_COMMON, 'a'))
        .to.equal(DESTS.TRANS_COMMON)
      expect(filter.filterTransaction(DESTS.TRANS_COMMON, 'ab'))
        .to.equal(DESTS.NONE)
      expect(filter.filterTransaction(DESTS.TRANS_COMMON, ''))
        .to.equal(DESTS.TRANS_COMMON)
      expect(filter.filterTransaction(DESTS.TRANS_COMMON, 'b'))
        .to.equal(DESTS.TRANS_COMMON)
      expect(filter.filterTransaction(DESTS.TRANS_COMMON, 'bc'))
        .to.equal(DESTS.LIMITED)
    })

    it('should not matter the order of the rules', function() {
      var filter = new AttributeFilter(makeAttributeFilterConfig({
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
      }))

      makeAssertions(filter)
    })

    it('should match `*` to anything', function() {
      var filter = new AttributeFilter(makeAttributeFilterConfig({
        attributes: {
          enabled: true,
          include_enabled: true,
          include: ['a*'],
          exclude: ['*']
        }
      }))

      expect(filter.filterTransaction(DESTS.TRANS_COMMON, 'a'))
        .to.equal(DESTS.TRANS_COMMON)
      expect(filter.filterTransaction(DESTS.TRANS_COMMON, 'ab'))
        .to.equal(DESTS.TRANS_COMMON)
      expect(filter.filterTransaction(DESTS.TRANS_COMMON, ''))
        .to.equal(DESTS.NONE)
      expect(filter.filterTransaction(DESTS.TRANS_COMMON, 'b'))
        .to.equal(DESTS.NONE)
      expect(filter.filterTransaction(DESTS.TRANS_COMMON, 'bc'))
        .to.equal(DESTS.NONE)
    })

    it('should parse dot rules correctly', function() {
      var filter = new AttributeFilter(makeAttributeFilterConfig({
        attributes: {
          enabled: true,
          include_enabled: true,
          include: ['a.c'],
          exclude: ['ab*']
        }
      }))

      expect(filter.filterTransaction(DESTS.TRANS_COMMON, 'a.c'))
        .to.equal(DESTS.TRANS_COMMON)
      expect(filter.filterTransaction(DESTS.TRANS_COMMON, 'abc'))
        .to.equal(DESTS.NONE)

      expect(filter.filterTransaction(DESTS.NONE, 'a.c'))
        .to.equal(DESTS.TRANS_COMMON)
      expect(filter.filterTransaction(DESTS.NONE, 'abc'))
        .to.equal(DESTS.NONE)
    })

    function makeAssertions(filter) {
      // Filters down from global rules
      expect(filter.filterTransaction(DESTS.TRANS_SCOPE, 'a'), 'a -> common')
        .to.equal(DESTS.TRANS_COMMON)
      expect(filter.filterTransaction(DESTS.TRANS_SCOPE, 'ab'), 'ab -> common')
        .to.equal(DESTS.TRANS_EVENT)
      expect(filter.filterTransaction(DESTS.TRANS_SCOPE, 'abc'), 'abc -> common')
        .to.equal(DESTS.NONE)

      // Filters down from destination rules.
      expect(filter.filterTransaction(DESTS.TRANS_SCOPE, 'b'), 'b -> common')
        .to.equal(DESTS.TRANS_COMMON)
      expect(filter.filterTransaction(DESTS.TRANS_SCOPE, 'bc'), 'bc -> common')
        .to.equal(DESTS.LIMITED)
      expect(filter.filterTransaction(DESTS.TRANS_SCOPE, 'bcd'), 'bcd -> common')
        .to.equal(DESTS.TRANS_COMMON)
      expect(filter.filterTransaction(DESTS.TRANS_SCOPE, 'bcde'), 'bcde -> common')
        .to.equal(DESTS.TRANS_COMMON)

      // Adds destinations on top of defaults.
      expect(filter.filterTransaction(DESTS.NONE, 'a'), 'a -> none')
        .to.equal(DESTS.TRANS_COMMON)
      expect(filter.filterTransaction(DESTS.NONE, 'ab'), 'ab -> none')
        .to.equal(DESTS.TRANS_EVENT)
    }
  })
})
