'use strict'

var chai    = require('chai')
var helper  = require('../../../lib/agent_helper')

var expect = chai.expect

describe('Domains', function() {
  var agent = null
  var d = null
  var tasks = []
  var interval = null

  beforeEach(function() {
    agent = helper.instrumentMockedAgent()

    // Starting on 9.3.0, calling `domain.exit` does not stop assertions in later
    // tests from being caught in this domain. In order to get around that we
    // are breaking out of the domain via a manual tasks queue.
    interval = setInterval(function() {
      while (tasks.length) {
        tasks.pop()()
      }
    }, 10)
  })

  afterEach(function() {
    d && d.exit()
    clearInterval(interval)
    helper.unloadAgent(agent)
  })

  it('should not be loaded just from loading the agent', function() {
    expect(process).to.have.property('domain', null)
  })

  it('should retain transaction scope on error events', function(done) {
    var domain = require('domain')
    d = domain.create()

    var checkedTransaction
    d.once('error', function(err) {
      // Asserting in a try catch because Domain will
      // handle the errors resulting in an infinite loop
      try {
        expect(err).to.exist
        expect(err.message).to.equal('whole new error!')

        var transaction = agent.getTransaction()
        expect(transaction && transaction.id)
          .to.equal(checkedTransaction && checkedTransaction.id)
      } catch (err) {
        done(err) // Bailing out with the error
        return
      }
      tasks.push(done)
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
