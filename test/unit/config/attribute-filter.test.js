'use strict'

var AttributeFilter = require('../../../lib/config/attribute-filter')
var copy = require('../../../lib/util/copy')
var EventEmitter = require('events').EventEmitter
var expect = require('chai').expect


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

  describe('#test', function() {
    it('should respect the rules', function() {
      var filter = new AttributeFilter(makeConfig({
        attributes: {
          enabled: true,
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

    it('should not matter the order of the rules', function() {
      var filter = new AttributeFilter(makeConfig({
        attributes: {
          enabled: true,
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

    function makeAssertions(filter) {
      expect(filter.test('transaction_events', 'a'), 'a -> events').to.be.true()
      expect(filter.test('transaction_events', 'ab'), 'ab -> events').to.be.true()
      expect(filter.test('transaction_events', 'abc'), 'abc -> events').to.be.false()

      expect(filter.test('transaction_events', 'b'), 'b -> events').to.be.true()
      expect(filter.test('transaction_events', 'bc'), 'bc -> events').to.be.false()
      expect(filter.test('transaction_events', 'bcd'), 'bcd -> events').to.be.true()
      expect(filter.test('transaction_events', 'bcde'), 'bcde -> events').to.be.true()

      expect(filter.test('transaction_tracer', 'a'), 'a -> tracer').to.be.true()
      expect(filter.test('transaction_tracer', 'ab'), 'ab -> tracer').to.be.false()
      expect(filter.test('transaction_tracer', 'abc'), 'abc -> tracer').to.be.false()

      expect(filter.test('transaction_tracer', 'b'), 'b -> tracer').to.be.true()
      expect(filter.test('transaction_tracer', 'bc'), 'bc -> tracer').to.be.true()
      expect(filter.test('transaction_tracer', 'bcd'), 'bcd -> tracer').to.be.true()
      expect(filter.test('transaction_tracer', 'bcde'), 'bcde -> tracer').to.be.true()
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
