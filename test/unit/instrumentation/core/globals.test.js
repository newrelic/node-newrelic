'use strict'

var chai    = require('chai')
var helper  = require('../../../lib/agent_helper')


var expect = chai.expect;

if (global.Promise) {
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
