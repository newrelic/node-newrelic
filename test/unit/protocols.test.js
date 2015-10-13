'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../lib/agent_helper')
var RemoteMethod = require('../../lib/collector/remote-method')

describe('errors', function () {
  var agent
  beforeEach(function () {
    agent = helper.loadMockedAgent()
    agent.config.capture_params = true
    agent.config.run_id = 1
  })
  afterEach(function () {
    helper.unloadAgent(agent)
  })
  it('should serialize down to match the protocol', function(done) {
    var error = new Error('test')
    error.stack = 'test stack'
    agent.errors.add(null, error)
    var payload = [agent.config.run_id, agent.errors.errors]
    RemoteMethod.prototype.serialize(payload, function serializeErrors(err, errors) {
      expect(err).equals(null)
      expect(errors).deep.equals('[1,[[0,"WebTransaction/Uri/*","test","Error",{"request_uri":"","userAttributes":{},"agentAttributes":{},"intrinsics":{},"stack_trace":["test stack"]}]]]')
      done()
    })
  })
})
