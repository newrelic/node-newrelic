'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../lib/agent_helper')
var RemoteMethod = require('../../lib/collector/remote-method')

describe('errors', function() {
  var agent
  beforeEach(function() {
    agent = helper.loadMockedAgent()
    agent.config.attributes.enabled = true
    agent.config.run_id = 1

    agent.errors.reconfigure(agent.config)
  })
  afterEach(function() {
    helper.unloadAgent(agent)
  })
  it('should serialize down to match the protocol', function(done) {
    var error = new Error('test')
    error.stack = 'test stack'
    agent.errors.add(null, error)
    var payload = agent.errors.traceAggregator._toPayloadSync()
    RemoteMethod.prototype.serialize(payload, function serializeErrors(err, errors) {
      expect(err).equals(null)
      expect(errors).deep.equals(
        '[1,[[0,"Unknown","test","Error",{"userAttributes":{},"agentAttributes":{},' +
        '"intrinsics":{"error.expected":false},"stack_trace":["test stack"]}]]]'
      )
      done()
    })
  })
})
