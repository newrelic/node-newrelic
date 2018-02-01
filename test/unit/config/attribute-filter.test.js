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
      var TRANS_EVENT = AttributeFilter.DESTINATIONS.TRANS_EVENT
      var TRANS_TRACE = AttributeFilter.DESTINATIONS.TRANS_TRACE
      expect(filter.test(TRANS_EVENT, 'a'), 'a -> events').to.be.true()
      expect(filter.test(TRANS_EVENT, 'ab'), 'ab -> events').to.be.true()
      expect(filter.test(TRANS_EVENT, 'abc'), 'abc -> events').to.be.false()

      expect(filter.test(TRANS_EVENT, 'b'), 'b -> events').to.be.true()
      expect(filter.test(TRANS_EVENT, 'bc'), 'bc -> events').to.be.false()
      expect(filter.test(TRANS_EVENT, 'bcd'), 'bcd -> events').to.be.true()
      expect(filter.test(TRANS_EVENT, 'bcde'), 'bcde -> events').to.be.true()

      expect(filter.test(TRANS_TRACE, 'a'), 'a -> tracer').to.be.true()
      expect(filter.test(TRANS_TRACE, 'ab'), 'ab -> tracer').to.be.false()
      expect(filter.test(TRANS_TRACE, 'abc'), 'abc -> tracer').to.be.false()

      expect(filter.test(TRANS_TRACE, 'b'), 'b -> tracer').to.be.true()
      expect(filter.test(TRANS_TRACE, 'bc'), 'bc -> tracer').to.be.true()
      expect(filter.test(TRANS_TRACE, 'bcd'), 'bcd -> tracer').to.be.true()
      expect(filter.test(TRANS_TRACE, 'bcde'), 'bcde -> tracer').to.be.true()
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
