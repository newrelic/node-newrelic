'use strict'

var path = require('path')
var chai = require('chai')
var expect = chai.expect
var helper = require('../lib/agent_helper')
var segment = require('../../lib/transaction/trace/segment')


describe('Tracer', function () {
  var agent
  var tracer


  beforeEach(function () {
    agent = helper.loadMockedAgent()
    tracer = agent.tracer
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  describe('when proxying a trace segment', function () {
    it('should not try to wrap a null handler', function () {
      expect(tracer.transactionProxy(null)).equal(null)
    })
  })

  describe('when proxying a trace segment', function () {
    it('should not try to wrap a null handler', function () {
      helper.runInTransaction(agent, function () {
        expect(tracer.wrapFunction('123', null, null)).equal(null)
      })
    })
  })

  describe('when proxying a callback', function () {
    it('should not try to wrap a null handler', function () {
      helper.runInTransaction(agent, function () {
        expect(tracer.bindFunction(null)).equal(null)
      })
    })
  })

  describe('when handling immutable errors', function () {
    it('should not break in annotation process', function () {
      helper.runInTransaction(agent, function (trans) {
        function wrapMe() {
          var err = new Error("FIREBOMB")
          Object.freeze(err)
          throw err
        }
      expect(tracer.bindFunction(wrapMe, new segment(trans, 'name'))).throws()
      })
    })
  })

  describe('when a transaction is created inside a transaction', function () {
    it('should reuse the existing transaction instead of nesting', function () {
      helper.runInTransaction(agent, function (trans) {
        var outer = trans.id
        helper.runInTransaction(agent, function (trans) {
          var inner = trans.id

          expect(inner).equal(outer)
        })
      })
    })
  })
})
