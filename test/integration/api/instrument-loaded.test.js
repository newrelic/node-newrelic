const test  = require('tap').test
const amqplib = require('amqplib')
const Shim = require('../../../lib/shim/shim')
const API    = require('../../../api')
const agentHelper = require('../../lib/agent_helper')



test('module that uses shim.require can be instrumented without an error', function testHelloWorld(t) {
    const agent = agentHelper.instrumentMockedAgent()
    const shimHelper = new Shim(agent, 'fake')
    const api = new API(agent)

    api.instrumentLoadedModule('amqplib', amqplib)
    t.end()
})