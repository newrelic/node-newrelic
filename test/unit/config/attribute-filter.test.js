'use strict'

var AttributeFilter = require('../../../lib/config/attribute-filter')
var copy = require('../../../lib/util/copy')
var EventEmitter = require('events').EventEmitter
var expect = require('chai').expect

var DESTS = AttributeFilter.DESTINATIONS


describe('AttributeFilter', function() {
  describe('constructor', function() {
    it('should require a config object', function() {
      expect(function() {
        return new AttributeFilter()
      }).to.throw()

      expect(function() {
        return new AttributeFilter(makeConfig())
      }).to.not.throw()
    })
  })

  describe('#filter', function() {
    it('should respect the rules', function() {
      var filter = new AttributeFilter(makeConfig({
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
      var filter = new AttributeFilter(makeConfig({
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

      expect(filter.filter(DESTS.COMMON, 'a')).to.equal(DESTS.COMMON)
      expect(filter.filter(DESTS.COMMON, 'ab')).to.equal(DESTS.NONE)
      expect(filter.filter(DESTS.COMMON, '')).to.equal(DESTS.COMMON)
      expect(filter.filter(DESTS.COMMON, 'b')).to.equal(DESTS.COMMON)
      expect(filter.filter(DESTS.COMMON, 'bc')).to.equal(DESTS.COMMON ^ DESTS.TRANS_EVENT)
    })

    it('should not matter the order of the rules', function() {
      var filter = new AttributeFilter(makeConfig({
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
      var filter = new AttributeFilter(makeConfig({
        attributes: {
          enabled: true,
          include_enabled: true,
          include: ['a*'],
          exclude: ['*']
        }
      }))

      expect(filter.filter(DESTS.COMMON, 'a')).to.equal(DESTS.COMMON)
      expect(filter.filter(DESTS.COMMON, 'ab')).to.equal(DESTS.COMMON)
      expect(filter.filter(DESTS.COMMON, '')).to.equal(DESTS.NONE)
      expect(filter.filter(DESTS.COMMON, 'b')).to.equal(DESTS.NONE)
      expect(filter.filter(DESTS.COMMON, 'bc')).to.equal(DESTS.NONE)
    })

    it('should parse dot rules correctly', function() {
      var filter = new AttributeFilter(makeConfig({
        attributes: {
          enabled: true,
          include_enabled: true,
          include: ['a.c'],
          exclude: ['ab*']
        }
      }))

      expect(filter.filter(DESTS.COMMON, 'a.c')).to.equal(DESTS.COMMON)
      expect(filter.filter(DESTS.COMMON, 'abc')).to.equal(DESTS.NONE)

      expect(filter.filter(DESTS.NONE, 'a.c')).to.equal(DESTS.COMMON)
      expect(filter.filter(DESTS.NONE, 'abc')).to.equal(DESTS.NONE)
    })

    function makeAssertions(filter) {
      // Filters down from global rules
      expect(filter.filter(DESTS.ALL, 'a'), 'a -> common').to.equal(DESTS.COMMON)
      expect(filter.filter(DESTS.ALL, 'ab'), 'ab -> common')
        .to.equal(DESTS.TRANS_EVENT)
      expect(filter.filter(DESTS.ALL, 'abc'), 'abc -> common').to.equal(DESTS.NONE)

      // Filters down from destination rules.
      expect(filter.filter(DESTS.ALL, 'b'), 'b -> common').to.equal(DESTS.COMMON)
      expect(filter.filter(DESTS.ALL, 'bc'), 'bc -> common')
        .to.equal(DESTS.COMMON & ~DESTS.TRANS_EVENT)
      expect(filter.filter(DESTS.ALL, 'bcd'), 'bcd -> common').to.equal(DESTS.COMMON)
      expect(filter.filter(DESTS.ALL, 'bcde'), 'bcde -> common').to.equal(DESTS.COMMON)

      // Adds destinations on top of defaults.
      expect(filter.filter(DESTS.NONE, 'a'), 'a -> none').to.equal(DESTS.COMMON)
      expect(filter.filter(DESTS.NONE, 'ab'), 'ab -> none').to.equal(DESTS.TRANS_EVENT)
    }
  })
})

function makeConfig(rules) {
  rules = copy.shallow(rules || {}, getDefault())
  return copy.shallow(rules, new EventEmitter())
}

function getDefault() {
  return {
    attributes: {
      enabled: true,
      include_enabled: true,
      include: [],
      exclude: []
    },

    transaction_events: {
      attributes: {
        enabled: true,
        include: [],
        exclude: []
      }
    },

    transaction_tracer: {
      attributes: {
        enabled: true,
        include: [],
        exclude: []
      }
    },

    error_collector: {
      attributes: {
        enabled: true,
        include: [],
        exclude: []
      }
    },

    browser_monitoring: {
      attributes: {
        enabled: false,
        include: [],
        exclude: []
      }
    }
  }
}
