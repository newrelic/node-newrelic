'use strict'

var chai    = require('chai')
var helper  = require('../../../lib/agent_helper')

var expect = chai.expect

if (global.Promise) {
  describe('Unhandled rejection', function () {
    var agent

    before(function () {
      agent = helper.instrumentMockedAgent()
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('should be associated with the transction if there is one', function(done){
      helper.runInTransaction(agent, function (transaction) {
        var rejected = Promise.reject('test rejection')
        var emitted = false

        // The `unhandledRejection` event has not existed as long as unhandled
        // rejections have. Thus we need to check if this even got triggered at
        // all before looking for the error on the transaction.
        process.once('unhandledRejection', function(){
          emitted = true
        })

        setTimeout(function () {
          if (emitted) {
            expect(transaction.exceptions.length).to.equal(1)
            expect(transaction.exceptions[0][0]).to.equal('test rejection')
          }
          done();
        }, 15)
      })
    })
  })

  describe('agent instrumentation of Promise', function () {
    var agent

    before(function () {
      agent = helper.instrumentMockedAgent()
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('should catch early throws with long chains', function (done) {
      var segment

      helper.runInTransaction(agent, function (transaction) {
        new Promise(function (resolve, reject) {
          segment = agent.tracer.getSegment()
          setTimeout(resolve, 0)
        })
        .then(function () {
          throw new Error('some error')
        })
        .then(function () {
          throw new Error('We shouldn\'t be here!')
        })
        .catch(function(err){
          process.nextTick(function () {
            expect(agent.tracer.getSegment()).to.equal(segment)
            expect(err.message).to.equal('some error')
            expect(agent.getTransaction()).to.exist
            done()
          })
        })
      })
    })
  })
}
