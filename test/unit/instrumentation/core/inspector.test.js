'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var chai = require('chai')
var helper = require('../../../lib/agent_helper')
var inspectorInstrumentation = require('../../../../lib/instrumentation/core/inspector')

var expect = chai.expect

describe('Inspector instrumentation', function() {
  var agent = null
  before(function() {
    agent = helper.loadMockedAgent()
  })

  after(function() {
    helper.unloadAgent(agent)
  })

  it('should not throw when passed null for the module', function() {
    expect(inspectorInstrumentation.bind(null, agent, null)).to.not.throw()
  })
})
