/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
tap.mochaGlobals()

const chai = require('chai')
const should = chai.should()
const sinon = require('sinon')
const expect = chai.expect
const Config = require('../../../lib/config')

tap.test('should handle a directly passed minimal configuration', (t) => {
  let config
  t.doesNotThrow(function testInitialize() {
    config = Config.initialize({})
  })
  t.equal(config.agent_enabled, true)

  t.end()
})

describe('the agent configuration', function() {
  describe('when loading invalid configuration file', function() {
    let realpathSyncStub
    const fsUnwrapped = require('../../../lib/util/unwrapped-core').fs

    beforeEach(function() {
      realpathSyncStub = sinon.stub(fsUnwrapped, 'realpathSync').callsFake(() => {
        return 'BadPath'
      })
    })

    afterEach(function() {
      realpathSyncStub.restore()
    })

    it('should continue agent startup with config.newrelic_home property removed',
      function() {
        const Cornfig = require('../../../lib/config')
        let configuration
        expect(function envTest() {
          configuration = Cornfig.initialize()
        }).not.throws()

        should.not.exist(configuration.newrelic_home)
      })
  })

  describe('when loading options via constructor', function() {
    it('should properly pick up on expected_messages', function() {
      const options = {
        expected_messages: {
          Error: ['oh no']
        }
      }
      var config = new Config({
        error_collector: options
      })
      expect(config.error_collector.expected_messages).eql(options.expected_messages)
    })

    it('should properly pick up on ignore_messages', function() {
      const options = {
        ignore_messages: {
          Error: ['oh no']
        }
      }
      var config = new Config({
        error_collector: options
      })
      expect(config.error_collector.ignore_messages).eql(options.ignore_messages)
    })

    it('should trim should trim spaces from license key', () => {
      const config = new Config({ license_key: ' license '})
      expect(config.license_key).equals('license')
    })
  })

  describe('when setting log level via config constructor', function() {
    it('should have log aliases', function() {
      var config = new Config({'logging': {'level': 'verbose'}})
      expect(config.logging.level).equal('trace')
    })
  })

  describe('when receiving server-side configuration', function() {
    var config

    beforeEach(function() {
      config = new Config()
    })

    it('should set the agent run ID', function() {
      config.onConnect({'agent_run_id': 1234})
      expect(config.run_id).equal(1234)
    })

    it('should set the account ID', function() {
      config.onConnect({'account_id': 76543})
      expect(config).to.have.property('account_id', 76543)
    })

    it('should set the application ID', function() {
      config.onConnect({'application_id': 76543})
      expect(config).to.have.property('application_id', 76543)
    })

    it('should always respect collect_traces', function() {
      expect(config.collect_traces).equal(true)
      config.onConnect({'collect_traces': false})
      expect(config.collect_traces).equal(false)
    })

    it('should disable the transaction tracer when told to', function() {
      expect(config.transaction_tracer.enabled).equal(true)
      config.onConnect({'transaction_tracer.enabled': false})
      expect(config.transaction_tracer.enabled).equal(false)
    })

    it('should always respect collect_errors', function() {
      expect(config.collect_errors).equal(true)
      config.onConnect({'collect_errors': false})
      expect(config.collect_errors).equal(false)
    })

    it('should always respect collect_span_events', () => {
      expect(config.collect_span_events).equal(true)
      expect(config.span_events.enabled).equal(true)
      config.onConnect({collect_span_events: false})
      expect(config.span_events.enabled).equal(false)
    })

    it('should disable the error tracer when told to', function() {
      expect(config.error_collector.enabled).equal(true)
      config.onConnect({'error_collector.enabled': false})
      expect(config.error_collector.enabled).equal(false)
    })

    it('should set apdex_t', function() {
      expect(config.apdex_t).equal(0.1)
      config.on('apdex_t', function(value) { expect(value).equal(0.05) })
      config.onConnect({'apdex_t': 0.05})
      expect(config.apdex_t).equal(0.05)
    })

    it('should map transaction_tracer.transaction_threshold', function() {
      expect(config.transaction_tracer.transaction_threshold).equal('apdex_f')
      config.onConnect({'transaction_tracer.transaction_threshold': 0.75})
      expect(config.transaction_tracer.transaction_threshold).equal(0.75)
    })

    it('should map URL rules to the URL normalizer', function(done) {
      config.on('url_rules', function(rules) {
        expect(rules).eql([{name : 'sample_rule'}])
        done()
      })

      config.onConnect({'url_rules': [{name : 'sample_rule'}]})
    })

    it('should map metric naming rules to the metric name normalizer', function(done) {
      config.on('metric_name_rules', function(rules) {
        expect(rules).eql([{name : 'sample_rule'}])
        done()
      })

      config.onConnect({'metric_name_rules': [{name : 'sample_rule'}]})
    })

    it('should map txn naming rules to the txn name normalizer', (done) => {
      config.on('transaction_name_rules', function(rules) {
        expect(rules).eql([{name : 'sample_rule'}])
        done()
      })

      config.onConnect({'transaction_name_rules': [{name : 'sample_rule'}]})
    })

    it('should log the product level', function() {
      expect(config.product_level).equal(0)
      config.onConnect({'product_level': 30})
      expect(config.product_level).equal(30)
    })

    it('should reject high_security', function() {
      config.onConnect({'high_security': true})
      expect(config.high_security).equal(false)
    })

    it('should configure cross application tracing', function() {
      expect(config.cross_application_tracer.enabled).to.be.true
      config.onConnect({'cross_application_tracer.enabled': false})
      expect(config.cross_application_tracer.enabled).to.be.false
    })

    describe('when handling embedded agent_config', function() {
      it('should not blow up when agent_config is passed in', function() {
        expect(function() {
          config.onConnect({'agent_config': {}})
        }).not.throws()
      })

      it('should ignore status codes set on the server', function() {
        config.onConnect({'agent_config': {
          'error_collector.ignore_status_codes': [401, 409, 415]
        }})
        expect(config.error_collector.ignore_status_codes).eql([404, 401, 409, 415])
      })

      it('should ignore status codes set on the server as strings', function() {
        config.onConnect({'agent_config': {
          'error_collector.ignore_status_codes': ['401', '409', '415']
        }})
        expect(config.error_collector.ignore_status_codes).eql([404, 401, 409, 415])
      })

      it('should ignore status codes set on the server when using a range', function() {
        config.onConnect({'agent_config': {
          'error_collector.ignore_status_codes': [401, '420-421', 415, 'abc']
        }})
        expect(config.error_collector.ignore_status_codes).eql([404, 401, 420, 421, 415])
      })

      it('should not add codes that parse to NaN', function() {
        config.onConnect({'agent_config': {
          'error_collector.ignore_status_codes': ['abc']
        }})
        expect(config.error_collector.ignore_status_codes).eql([404])
      })

      it('should not ignore status codes from server with invalid range', function() {
        config.onConnect({'agent_config': {
          'error_collector.ignore_status_codes': ['421-420']
        }})
        expect(config.error_collector.ignore_status_codes).eql([404])
      })

      it('should not ignore status codes from server if given out of range', function() {
        config.onConnect({'agent_config': {
          'error_collector.ignore_status_codes': ['1-1776']
        }})
        expect(config.error_collector.ignore_status_codes).eql([404])
      })

      it('should ignore negative status codes from server', function() {
        config.onConnect({'agent_config': {
          'error_collector.ignore_status_codes': [-7]
        }})
        expect(config.error_collector.ignore_status_codes).eql([404, -7])
      })
    })

    it('should load named transaction apdexes', function() {
      var apdexes = {'WebTransaction/Custom/UrlGenerator/en/betting/Football' : 7.0}
      expect(config.web_transactions_apdex).eql({})
      config.onConnect({'web_transactions_apdex': apdexes})
      expect(config.web_transactions_apdex).eql(apdexes)
    })

    it('should not configure record_sql', function() {
      expect(config.transaction_tracer.record_sql).equal('off')
      config.onConnect({'transaction_tracer.record_sql': 'raw'})
      expect(config.transaction_tracer.record_sql).equal('off')
    })

    it('should not configure explain_threshold', function() {
      expect(config.transaction_tracer.explain_threshold).equal(500)
      config.onConnect({'transaction_tracer.explain_threshold': 100})
      expect(config.transaction_tracer.explain_threshold).equal(500)
    })

    it('should not configure slow_sql.enabled', function() {
      expect(config.slow_sql.enabled).equal(false)
      config.onConnect({'transaction_tracer.enabled': true})
      expect(config.slow_sql.enabled).equal(false)
    })

    it('should not configure slow_sql.max_samples', function() {
      expect(config.slow_sql.max_samples).equal(10)
      config.onConnect({'transaction_tracer.max_samples': 5})
      expect(config.slow_sql.max_samples).equal(10)
    })

    it('should not blow up when sampling_rate is received', function() {
      expect(function() {
        config.onConnect({'sampling_rate': 0})
      }).not.throws()
    })

    it('should not blow up when cross_process_id is received', function() {
      expect(function() {
        config.onConnect({'cross_process_id': 'junk'})
      }).not.throws()
    })

    it('should not blow up with cross_application_tracer.enabled', () => {
      expect(function() {
        config.onConnect({'cross_application_tracer.enabled': true})
      }).not.throws()
    })

    it('should not blow up when encoding_key is received', function() {
      expect(function() {
        config.onConnect({'encoding_key': 'hamsnadwich'})
      }).not.throws()
    })

    it('should not blow up when trusted_account_ids is received', function() {
      expect(function() {
        config.onConnect({'trusted_account_ids': [1, 2, 3]})
      }).to.not.throw()
    })

    it('should not blow up when trusted_account_key is received', function() {
      expect(function() {
        config.onConnect({'trusted_account_key': 123})
      }).to.not.throw()
    })

    it('should not blow up when high_security is received', function() {
      expect(function() {
        config.onConnect({'high_security': true})
      }).not.throws()
    })

    it('should not blow up when ssl is received', function() {
      expect(function() {
        config.onConnect({'ssl': true})
      }).not.throws()
    })

    it('should not disable ssl', function() {
      expect(function() {
        config.onConnect({'ssl': false})
      }).not.throws()
      expect(config.ssl).to.be.true
    })

    it('should not blow up when transaction_tracer.record_sql is received', function() {
      expect(function() {
        config.onConnect({'transaction_tracer.record_sql': true})
      }).not.throws()
    })

    it('should not blow up when slow_sql.enabled is received', function() {
      expect(function() {
        config.onConnect({'slow_sql.enabled': true})
      }).not.throws()
    })

    it('should not blow up when rum.load_episodes_file is received', function() {
      expect(function() {
        config.onConnect({'rum.load_episodes_file': true})
      }).not.throws()
    })

    it('should not blow up when beacon is received', function() {
      expect(function() {
        config.onConnect({'beacon': 'beacon-0.newrelic.com'})
      }).not.throws()
    })

    it('should not blow up when beacon is received', function() {
      expect(function() {
        config.onConnect({'error_beacon': null})
      }).not.throws()
    })

    it('should not blow up when js_agent_file is received', function() {
      expect(function() {
        config.onConnect({'js_agent_file': 'jxc4afffef.js'})
      }).not.throws()
    })

    it('should not blow up when js_agent_loader_file is received', function() {
      expect(function() {
        config.onConnect({'js_agent_loader_file': 'nr-js-bootstrap.js'})
      }).not.throws()
    })

    it('should not blow up when episodes_file is received', function() {
      expect(function() {
        config.onConnect({'episodes_file': 'js-agent.newrelic.com/nr-100.js'})
      }).not.throws()
    })

    it('should not blow up when episodes_url is received', function() {
      expect(function() {
        config.onConnect({'episodes_url': 'https://js-agent.newrelic.com/nr-100.js'})
      }).not.throws()
    })

    it('should not blow up when browser_key is received', function() {
      expect(function() {
        config.onConnect({'browser_key': 'beefchunx'})
      }).not.throws()
    })

    it('should not blow up when collect_analytics_events is received', () => {
      config.transaction_events.enabled = true
      expect(function() {
        config.onConnect({'collect_analytics_events': false})
      }).not.throws()
      expect(config.transaction_events.enabled).equals(false)
    })

    it('should not blow up when transaction_events.enabled is received', function() {
      expect(function() {
        config.onConnect({'transaction_events.enabled': false})
      }).not.throws()
      expect(config.transaction_events.enabled).equals(false)
    })

    it('should override default max_payload_size_in_bytes', function() {
      expect(function() {
        config.onConnect({max_payload_size_in_bytes: 100})
      }).not.throws()
      expect(config.max_payload_size_in_bytes).equals(100)
    })

    it('should not accept serverless_mode', () => {
      expect(() => {
        config.onConnect({'serverless_mode.enabled': true})
      }).not.throws()
      expect(config.serverless_mode.enabled).to.be.false
    })

    describe('when event_harvest_config is set', function() {
      it('should emit event_harvest_config when harvest interval is changed', (done) => {
        const expectedHarvestConfig = {
          report_period_ms: 5000,
          harvest_limits: {
            analytic_event_data: 833,
            custom_event_data: 833,
            error_event_data: 8
          }
        }

        config.once('event_harvest_config', function(harvestconfig) {
          expect(harvestconfig).deep.equal(expectedHarvestConfig)

          done()
        })

        config.onConnect({'event_harvest_config': expectedHarvestConfig})
      })

      it('should update event_harvest_config when a sub-value changed', (done) => {
        const originalHarvestConfig = {
          report_period_ms: 60000,
          harvest_limits: {
            analytic_event_data: 10000,
            custom_event_data: 10000,
            error_event_data: 100
          }
        }

        config.event_harvest_config = originalHarvestConfig

        const expectedHarvestConfig = {
          report_period_ms: 5000,
          harvest_limits: {
            analytic_event_data: 833,
            custom_event_data: 833,
            error_event_data: 8
          }
        }

        config.once('event_harvest_config', function(harvestconfig) {
          expect(harvestconfig).deep.equal(expectedHarvestConfig)

          done()
        })

        config.onConnect({'event_harvest_config': expectedHarvestConfig})
      })
    })

    describe('when apdex_t is set', function() {
      it('should emit `apdex_t` when apdex_t changes', function(done) {
        config.once('apdex_t', function(apdexT) {
          expect(apdexT).equal(0.75)

          done()
        })

        config.onConnect({'apdex_t': 0.75})
      })

      it('should update its apdex_t only when it has changed', function() {
        expect(config.apdex_t).equal(0.1)

        config.once('apdex_t', function() {
          throw new Error('should never get here')
        })

        config.onConnect({'apdex_t': 0.1})
      })
    })
  })

  describe('#publicSettings', function() {
    let configuration

    beforeEach(function() {
      configuration = Config.initialize({})

      // ensure environment is clean
      delete configuration.newrelic_home
    })

    afterEach(() => {
      configuration = null
    })

    it('should be able to create a flat JSONifiable version', function() {
      const pub = configuration.publicSettings()

      // The object returned from Config.publicSettings
      // should not have any values of type object
      for (let key in pub) {
        if (pub[key] !== null) {
          expect(typeof pub[key]).not.equal('object')
        }
      }
    })

    it('should not return serialized attributeFilter object from publicSettings', () => {
      var pub = configuration.publicSettings()

      var result = Object.keys(pub).some((key) => {
        return key.includes('attributeFilter')
      })
      expect (result).to.be.false
    })

    it('should not return serialized mergeServerConfig props from publicSettings', () => {
      const pub = configuration.publicSettings()
      const result = Object.keys(pub).some((key) => {
        return key.includes('mergeServerConfig')
      })
      expect(result).to.be.false
    })

    it('should obfuscate certificates in publicSettings', () => {
      configuration = Config.initialize({
        certificates: ['some-pub-cert-1', 'some-pub-cert-2']
      })

      const publicSettings = configuration.publicSettings()

      expect(publicSettings['certificates.0']).to.equal('****')
      expect(publicSettings['certificates.1']).to.equal('****')
    })
  })
})
