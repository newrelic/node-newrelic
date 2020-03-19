'use strict'

const tap = require('tap')
// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
tap.mochaGlobals()

var API = require('../../../api')
var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')

describe('the New Relic agent API', function() {
  var agent
  var api

  beforeEach(function() {
    agent = helper.loadMockedAgent()
    api = new API(agent)
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  describe('getLinkingMetadata', () => {
    it('should return metadata necessary for linking data to a trace', () => {
      let metadata = api.getLinkingMetadata()

      expect(metadata['trace.id']).to.be.undefined
      expect(metadata['span.id']).to.be.undefined
      expect(metadata['entity.name']).to.equal('New Relic for Node.js tests')
      expect(metadata['entity.type']).to.equal('SERVICE')
      expect(metadata['entity.guid']).to.be.undefined
      expect(metadata.hostname).to.equal(agent.config.getHostnameSafe())

      // Test in a transaction
      helper.runInTransaction(agent, function() {
        metadata = api.getLinkingMetadata()
        // trace and span id are omitted when dt is disabled
        expect(metadata['trace.id']).to.be.undefined
        expect(metadata['span.id']).to.be.undefined
        expect(metadata['entity.name']).to.equal('New Relic for Node.js tests')
        expect(metadata['entity.type']).to.equal('SERVICE')
        expect(metadata['entity.guid']).to.be.undefined
        expect(metadata.hostname).to.equal(agent.config.getHostnameSafe())
      })

      // With DT enabled
      agent.config.distributed_tracing.enabled = true

      // Trace and span id are omitted when there is no active transaction
      expect(metadata['trace.id']).to.be.undefined
      expect(metadata['span.id']).to.be.undefined
      expect(metadata['entity.name']).to.equal('New Relic for Node.js tests')
      expect(metadata['entity.type']).to.equal('SERVICE')
      expect(metadata['entity.guid']).to.be.undefined
      expect(metadata.hostname).to.equal(agent.config.getHostnameSafe())

      // Test in a transaction
      helper.runInTransaction(agent, function() {
        metadata = api.getLinkingMetadata()
        expect(metadata['trace.id']).to.be.a('string')
        expect(metadata['span.id']).to.be.a('string')
        expect(metadata['entity.name']).to.equal('New Relic for Node.js tests')
        expect(metadata['entity.type']).to.equal('SERVICE')
        expect(metadata['entity.guid']).to.be.undefined
        expect(metadata.hostname).to.equal(agent.config.getHostnameSafe())
      })

      // Test with an entity_guid set and in a transaction
      helper.unloadAgent(agent)
      agent = helper.loadMockedAgent({
        entity_guid: 'test',
        distributed_tracing: { enabled: true }
      })
      api = new API(agent)
      helper.runInTransaction(agent, function() {
        metadata = api.getLinkingMetadata()
        expect(metadata['trace.id']).to.be.a('string')
        expect(metadata['span.id']).to.be.a('string')
        expect(metadata['entity.name']).to.equal('New Relic for Node.js tests')
        expect(metadata['entity.type']).to.equal('SERVICE')
        expect(metadata['entity.guid']).to.equal('test')
        expect(metadata.hostname).to.equal(agent.config.getHostnameSafe())
      })
    })
  })
})
