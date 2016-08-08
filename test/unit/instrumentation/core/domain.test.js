'use strict'

var domain  = require('domain')
var chai    = require('chai')
var helper  = require('../../../lib/agent_helper')

var expect = chai.expect

describe('Domains', function() {
  var agent = null
  var d

  before(function() {
    d = domain.create()
    agent = helper.instrumentMockedAgent()
  })

  after(function() {
    d.exit()
    helper.unloadAgent(agent)
  })

  it('should retain transaction scope on error events', function(done) {
    var checkedTransaction
    d.on('error', function(err) {
      expect(agent.getTransaction()).to.equal(checkedTransaction)
      done()
    })

    helper.runInTransaction(agent, function(transaction) {
      checkedTransaction = transaction
      d.run(function() {
        setTimeout(function() {
          throw new Error("whole new error!")
        }, 1000)
      })
    })
  })
})
