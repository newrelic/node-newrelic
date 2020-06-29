/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const helper = require('../../lib/agent_helper')
const chai = require('chai')
const expect  = chai.expect

describe('Server Config', function() {
  describe('Merging Server Config Values', function() {
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

    it('_fromServer misconfigure should not explode', function() {
      helper.runInTransaction(agent, function() {
        // whoops, a misconfiguration
        agent.config.error_collector.ignore_messages = {'Foo':'bar'}
        let params = {'error_collector.ignore_messages':{'Foo':['zap']}}
        agent.config._fromServer(params, 'error_collector.ignore_messages')
        let expected = {'Foo':['zap']}  // expect this to replace
        expect(agent.config.error_collector.ignore_messages).eql(expected)
      })
    })

    it('_fromServer local misconfigure should not explode', function() {
      helper.runInTransaction(agent, function() {
        // whoops, a misconfiguration
        agent.config.error_collector.ignore_messages = {'Foo':'bar'}
        let params = {'error_collector.ignore_messages':{'Foo':['zap']}}
        agent.config._fromServer(params, 'error_collector.ignore_messages')
        let expected = {'Foo':['zap']}  // expect this to replace
        expect(agent.config.error_collector.ignore_messages).eql(expected)
      })
    })

    it('_fromServer ignore_message misconfiguration should be ignored', function() {
      helper.runInTransaction(agent, function() {
        // whoops, a misconfiguration
        const badServerValues = [
          null,
          42,
          'a',
          [1,2,3,4],
          {'Foo': null, 'Bar':['zap']},
          {'Foo': 42, 'Bar':['zap']},
          {'Foo': 'a', 'Bar':['zap']}
        ]
        badServerValues.forEach(function(value) {
          const expected = {'Foo':['zap']}
          agent.config.error_collector.ignore_messages = expected
          const params = {'error_collector.ignore_messages':value}
          agent.config._fromServer(params, 'error_collector.ignore_messages')
          expect(agent.config.error_collector.ignore_messages).eql(expected)
        })
      })
    })

    it('_fromServer expect_message misconfiguration should be ignored', function() {
      helper.runInTransaction(agent, function() {
        // whoops, a misconfiguration
        const badServerValues = [
          null,
          42,
          'a',
          [1,2,3,4],
          {'Foo': null, 'Bar':['zap']},
          {'Foo': 42, 'Bar':['zap']},
          {'Foo': 'a', 'Bar':['zap']}
        ]
        badServerValues.forEach(function(value) {
          const expected = {'Foo':['zap']}
          agent.config.error_collector.expect_messages = expected
          const params = {'error_collector.expect_messages':value}
          agent.config._fromServer(params, 'error_collector.expect_messages')
          expect(agent.config.error_collector.expect_messages).eql(expected)
        })
      })
    })
    it('_fromServer ignore_classes misconfiguration should be ignored', function() {
      helper.runInTransaction(agent, function() {
        // classes should be an array of strings
        const badServerValues = [
          null,
          42,
          'a',
          {'Foo': null, 'Bar':['zap']},
          {'Foo': 42, 'Bar':['zap']},
          {'Foo': 'a', 'Bar':['zap']},
          {'Foo': ['foo']}
        ]
        badServerValues.forEach(function(value) {
          const expected = ['Error','AnotherError']
          agent.config.error_collector.ignore_classes = expected
          const params = {'error_collector.ignore_classes':value}
          agent.config._fromServer(params, 'error_collector.ignore_classes')
          expect(agent.config.error_collector.ignore_classes).eql(expected)
        })
      })
    })

    it('_fromServer expect_classes misconfiguration should be ignored', function() {
      helper.runInTransaction(agent, function() {
        // classes should be an array of strings
        const badServerValues = [
          null,
          42,
          'a',
          {'Foo': null, 'Bar':['zap']},
          {'Foo': 42, 'Bar':['zap']},
          {'Foo': 'a', 'Bar':['zap']},
          {'Foo': ['foo']}
        ]
        badServerValues.forEach(function(value) {
          const expected = ['Error','AnotherError']
          agent.config.error_collector.expect_classes = expected
          const params = {'error_collector.expect_classes':value}
          agent.config._fromServer(params, 'error_collector.expect_classes')
          expect(agent.config.error_collector.expect_classes).eql(expected)
        })
      })
    })

    it('_fromServer ignore_status_codes misconfiguration should be ignored', function() {
      helper.runInTransaction(agent, function() {
        // classes should be an array of strings and numbers
        const badServerValues = [
          null,
          42,
          'a',
          {'Foo': null, 'Bar':['zap']},
          {'Foo': 42, 'Bar':['zap']},
          {'Foo': 'a', 'Bar':['zap']},
          {'Foo': ['foo']}
        ]
        badServerValues.forEach(function(value) {
          const toSet = [500, '501','502-505']
          const expected = [500, 501, 502, 503, 504, 505]
          agent.config.error_collector.ignore_status_codes = toSet
          const params = {'error_collector.ignore_status_codes':value}
          agent.config._fromServer(params, 'error_collector.ignore_status_codes')
          expect(agent.config.error_collector.ignore_status_codes).eql(expected)
        })
      })
    })

    it('_fromServer expect_status_codes misconfiguration should be ignored', function() {
      helper.runInTransaction(agent, function() {
        // classes should be an array of strings and numbers
        const badServerValues = [
          null,
          42,
          'a',
          {'Foo': null, 'Bar':['zap']},
          {'Foo': 42, 'Bar':['zap']},
          {'Foo': 'a', 'Bar':['zap']},
          {'Foo': ['foo']}
        ]
        badServerValues.forEach(function(value) {
          const toSet = [500, '501','502-505']
          const expected = [500, 501, 502, 503, 504, 505]
          agent.config.error_collector.expected_status_codes = toSet
          const params = {'error_collector.expected_status_codes':value}
          agent.config._fromServer(params, 'error_collector.expected_status_codes')
          expect(agent.config.error_collector.expected_status_codes).eql(expected)
        })
      })
    })

    it('_fromServer should de-duplicate arrays nested in object', function() {
      helper.runInTransaction(agent, function() {
        // whoops, a misconfiguration
        agent.config.error_collector.ignore_messages = {'Foo':['zap','bar']}
        let params = {'error_collector.ignore_messages':{'Foo':['bar']}}
        agent.config._fromServer(params, 'error_collector.ignore_messages')
        let expected = {'Foo':['zap','bar']}  // expect this to replace
        expect(agent.config.error_collector.ignore_messages).eql(expected)
      })
    })
  })
})
