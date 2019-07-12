'use strict'

const helper = require('../../lib/agent_helper')
const chai = require('chai')
const expect  = chai.expect

describe('Expected Errors', function() {
  describe('when expeced configuration is present', function() {
    let agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it('_fromServer should update ignore_status_codes', function() {
      helper.runInTransaction(agent, function() {
        agent.config.error_collector.ignore_status_codes = [404]
        let params = {'error_collector.ignore_status_codes':['501-505']}
        agent.config._fromServer(params, 'error_collector.ignore_status_codes')
        let expected = [404,501,502,503,504,505]
        expect(agent.config.error_collector.ignore_status_codes).eql(expected)
      })
    })

    it('_fromServer should update expected_status_codes', function() {
      helper.runInTransaction(agent, function() {
        agent.config.error_collector.expected_status_codes = [404]
        let params = {'error_collector.expected_status_codes':['501-505']}
        agent.config._fromServer(params, 'error_collector.expected_status_codes')
        let expected = [404,501,502,503,504,505]
        expect(agent.config.error_collector.expected_status_codes).eql(expected)
      })
    })

    it('_fromServer should update expected_classes', function() {
      helper.runInTransaction(agent, function() {
        agent.config.error_collector.expected_classes = ['Foo']
        let params = {'error_collector.expected_classes':['Bar']}
        agent.config._fromServer(params, 'error_collector.expected_classes')
        let expected = ['Foo','Bar']
        expect(agent.config.error_collector.expected_classes).eql(expected)
      })
    })

    it('_fromServer should update ignore_classes', function() {
      helper.runInTransaction(agent, function() {
        agent.config.error_collector.ignore_classes = ['Foo']
        let params = {'error_collector.ignore_classes':['Bar']}
        agent.config._fromServer(params, 'error_collector.ignore_classes')
        let expected = ['Foo','Bar']
        expect(agent.config.error_collector.ignore_classes).eql(expected)
      })
    })

    it('_fromServer should update expected_messages', function() {
      helper.runInTransaction(agent, function() {
        agent.config.error_collector.expected_messages = {'Foo':['bar']}
        let params = {'error_collector.expected_messages':{'Zip':['zap']}}
        agent.config._fromServer(params, 'error_collector.expected_messages')
        let expected = {'Foo':['bar'],'Zip':['zap']}
        expect(agent.config.error_collector.expected_messages).eql(expected)
      })
    })

    it('_fromServer should update ignore_messages', function() {
      helper.runInTransaction(agent, function() {
        agent.config.error_collector.ignore_messages = {'Foo':['bar']}
        let params = {'error_collector.ignore_messages':{'Zip':['zap']}}
        agent.config._fromServer(params, 'error_collector.ignore_messages')
        let expected = {'Foo':['bar'],'Zip':['zap']}
        expect(agent.config.error_collector.ignore_messages).eql(expected)
      })
    })

    it('_fromServer should merge if keys match', function() {
      helper.runInTransaction(agent, function() {
        agent.config.error_collector.ignore_messages = {'Foo':['bar']}
        let params = {'error_collector.ignore_messages':{'Foo':['zap']}}
        agent.config._fromServer(params, 'error_collector.ignore_messages')
        let expected = {'Foo':['bar', 'zap']}
        expect(agent.config.error_collector.ignore_messages).eql(expected)
      })
    })

    it('_fromServer mis configure should not explode', function() {
      helper.runInTransaction(agent, function() {
        // whoops, a mis configuration
        agent.config.error_collector.ignore_messages = {'Foo':'bar'}
        let params = {'error_collector.ignore_messages':{'Foo':['zap']}}
        agent.config._fromServer(params, 'error_collector.ignore_messages')
        let expected = {'Foo':['zap']}  // expect this to replace
        expect(agent.config.error_collector.ignore_messages).eql(expected)
      })
    })
  })
})
