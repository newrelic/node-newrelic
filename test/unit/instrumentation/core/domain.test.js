'use strict'

var chai    = require('chai')
var helper  = require('../../../lib/agent_helper')

var expect = chai.expect

describe('Domains', function() {
  var agent = null
  var d = null

  beforeEach(function() {
    agent = helper.instrumentMockedAgent()
  })

  afterEach(function() {
    d && d.exit()
    helper.unloadAgent(agent)
  })

  it('should not be loaded just from loading the agent', function() {
    expect(process).to.have.property('domain', null)
  })

  it('should retain transaction scope on error events', function(done) {
    var domain = require('domain')
    d = domain.create()

    var checkedTransaction
    d.on('error', function(err) {
      expect(err).to.exist()
      expect(err.message).to.equal('whole new error!')
      expect(agent.getTransaction()).to.equal(checkedTransaction)
      done()
    })

    helper.runInTransaction(agent, function(transaction) {
      checkedTransaction = transaction
      d.run(function() {
        setTimeout(function() {
          throw new Error('whole new error!')
        }, 50)
      })
    })
  })
})
