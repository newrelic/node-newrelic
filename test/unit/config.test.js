'use strict'

var path   = require('path')
  , chai   = require('chai')
  , should = chai.should()
  , expect = chai.expect
  , fs     = require('fs')
  , Config = require('../../lib/config')


function idempotentEnv(name, value, callback) {
  var is, saved

  // process.env is not a normal object
  if (Object.hasOwnProperty.call(process.env, name)) {
    is = true
    saved = process.env[name]
  }

  process.env[name] = value
  try {
    var tc = Config.initialize({})
    callback(tc)
  }
  finally {
    if (is) {
      process.env[name] = saved
    }
    else {
      delete process.env[name]
    }
  }
}

describe("the agent configuration", function () {
  it("should handle a directly passed minimal configuration", function () {
    var c
    expect(function testInitialize() {
      c = Config.initialize({})
    }).not.throws()
    expect(c.agent_enabled).equal(true)
  })

  describe("when overriding configuration values via environment variables",
  function () {
    it("should pick up the application name", function () {
      idempotentEnv('NEW_RELIC_APP_NAME', 'feeling testy,and schizophrenic',
                    function (tc) {
        should.exist(tc.app_name)
        expect(tc.app_name).eql(['feeling testy', 'and schizophrenic'])
      })
    })

    it("should trim spaces from multiple application names ", function () {
      idempotentEnv('NEW_RELIC_APP_NAME', 'zero,one, two,  three,   four',
                    function (tc) {
        should.exist(tc.app_name)
        expect(tc.app_name).eql(['zero', 'one', 'two', 'three', 'four'])
      })
    })

    it("should pick up the license key", function () {
      idempotentEnv('NEW_RELIC_LICENSE_KEY', 'hambulance', function (tc) {
        should.exist(tc.license_key)
        expect(tc.license_key).equal('hambulance')
      })
    })

    it("should pick up the collector host", function () {
      idempotentEnv('NEW_RELIC_HOST', 'localhost', function (tc) {
        should.exist(tc.host)
        expect(tc.host).equal('localhost')
      })
    })

    it("should pick up the collector port", function () {
      idempotentEnv('NEW_RELIC_PORT', 7777, function (tc) {
        should.exist(tc.port)
        expect(tc.port).equal('7777')
      })
    })

    it("should pick up the proxy host", function () {
      idempotentEnv('NEW_RELIC_PROXY_HOST', 'proxyhost', function (tc) {
        should.exist(tc.proxy_host)
        expect(tc.proxy_host).equal('proxyhost')
      })
    })

    it("should pick up the proxy port", function () {
      idempotentEnv('NEW_RELIC_PROXY_PORT', 7777, function (tc) {
        should.exist(tc.proxy_port)
        expect(tc.proxy_port).equal('7777')
      })
    })

    it("should pick up the log level", function () {
      idempotentEnv('NEW_RELIC_LOG_LEVEL', 'XXNOEXIST', function (tc) {
        should.exist(tc.logging.level)
        expect(tc.logging.level).equal('XXNOEXIST')
      })
    })

    it("should pick up the log filepath", function () {
      idempotentEnv('NEW_RELIC_LOG', '/highway/to/the/danger/zone', function (tc) {
        should.exist(tc.logging.filepath)
        expect(tc.logging.filepath).equal('/highway/to/the/danger/zone')
      })
    })

    it("should pick up whether server-side config is enabled", function () {
      idempotentEnv('NEW_RELIC_IGNORE_SERVER_CONFIGURATION', 'yeah', function (tc) {
        should.exist(tc.ignore_server_configuration)
        expect(tc.ignore_server_configuration).equal(true)
      })
    })

    it("should pick up whether the agent is enabled", function () {
      idempotentEnv('NEW_RELIC_ENABLED', 0, function (tc) {
        should.exist(tc.agent_enabled)
        expect(tc.agent_enabled).equal(false)
      })
    })

    it("should pick up whether the apdexT is set", function () {
      idempotentEnv('NEW_RELIC_APDEX', 0.666, function (tc) {
        should.exist(tc.apdex_t)
        expect(tc.apdex_t).equal('0.666')
      })
    })

    it("should pick up whether to capture request parameters", function () {
      idempotentEnv('NEW_RELIC_CAPTURE_PARAMS', 'yes', function (tc) {
        should.exist(tc.capture_params)
        expect(tc.capture_params).equal(true)
      })
    })

    it("should pick up ignored request parameters", function () {
      idempotentEnv('NEW_RELIC_IGNORED_PARAMS', 'one,two,three', function (tc) {
        should.exist(tc.ignored_params)
        expect(tc.ignored_params).eql(['one', 'two', 'three'])
      })
    })

    it("should pick up whether the error collector is enabled", function () {
      idempotentEnv('NEW_RELIC_ERROR_COLLECTOR_ENABLED', 'NO', function (tc) {
        should.exist(tc.error_collector.enabled)
        expect(tc.error_collector.enabled).equal(false)
      })
    })

    it("should pick up which status codes are ignored", function () {
      idempotentEnv('NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES',
                    '401,404,502', function (tc) {
        should.exist(tc.error_collector.ignore_status_codes)
        expect(tc.error_collector.ignore_status_codes).eql([401, 404, 502])
      })
    })

    it("should pick up whether the transaction tracer is enabled", function () {
      idempotentEnv('NEW_RELIC_TRACER_ENABLED', false, function (tc) {
        should.exist(tc.transaction_tracer.enabled)
        expect(tc.transaction_tracer.enabled).equal(false)
      })
    })

    it("should pick up the transaction trace threshold", function () {
      idempotentEnv('NEW_RELIC_TRACER_THRESHOLD', 0.02, function (tc) {
        should.exist(tc.transaction_tracer.transaction_threshold)
        expect(tc.transaction_tracer.transaction_threshold).equal('0.02')
      })
    })

    it("should pick up the transaction trace Top N scale", function () {
      idempotentEnv('NEW_RELIC_TRACER_TOP_N', 5, function (tc) {
        should.exist(tc.transaction_tracer.top_n)
        expect(tc.transaction_tracer.top_n).equal('5')
      })
    })

    it("should pick up whether internal metrics are enabled", function () {
      idempotentEnv('NEW_RELIC_DEBUG_METRICS', true, function (tc) {
        should.exist(tc.debug.internal_metrics)
        expect(tc.debug.internal_metrics).equal(true)
      })
    })

    it("should pick up whether tracing of the transaction tracer is enabled",
       function () {
      idempotentEnv('NEW_RELIC_DEBUG_TRACER', 'yup', function (tc) {
        should.exist(tc.debug.tracer_tracing)
        expect(tc.debug.tracer_tracing).equal(true)
      })
    })

    it("should pick up renaming rules", function () {
      idempotentEnv(
        'NEW_RELIC_NAMING_RULES',
        '{"name":"u","pattern":"^t"},{"name":"t","pattern":"^u"}',
        function (tc) {
          should.exist(tc.rules.name)
          expect(tc.rules.name).eql([
            {name : 'u', pattern : '^t'},
            {name : 't', pattern : '^u'},
          ])
        }
      )
    })

    it("should pick up ignoring rules", function () {
      idempotentEnv(
        'NEW_RELIC_IGNORING_RULES',
        '^/test,^/no_match,^/socket\\.io/,^/api/.*/index$',
        function (tc) {
          should.exist(tc.rules.ignore)
          expect(tc.rules.ignore).eql([
            '^/test',
            '^/no_match',
            '^/socket\\.io/',
            '^/api/.*/index$'
          ])
        }
      )
    })

    it("should pick up whether URL backstop has been turned off",
       function () {
      idempotentEnv('NEW_RELIC_ENFORCE_BACKSTOP', 'f', function (tc) {
        should.exist(tc.enforce_backstop)
        expect(tc.enforce_backstop).equal(false)
      })
    })

    it("should pick app name from APP_POOL_ID", function () {
      idempotentEnv('APP_POOL_ID', 'Simple Azure app', function (tc) {
        should.exist(tc.app_name)
        expect(tc.applications()).eql(['Simple Azure app'])
      })
    })
  })

  describe("with default properties", function () {
    var configuration

    before(function () {
      configuration = Config.initialize({})

      // ensure environment is clean
      delete configuration.newrelic_home
    })

    it("should have no application name", function () {
      expect(configuration.app_name).eql([])
    })

    it("should return no application name", function () {
      expect(configuration.applications()).eql([])
    })

    it("should have no application ID", function () {
      expect(configuration.application_id).eql(null)
    })

    it("should have no license key", function () {
      expect(configuration.license_key).equal('')
    })

    it("should connect to the collector at collector.newrelic.com", function () {
      expect(configuration.host).equal('collector.newrelic.com')
    })

    it("should connect to the collector on port 443", function () {
      expect(configuration.port).equal(443)
    })

    it("should have SSL enabled", function () {
      expect(configuration.ssl).equal(true)
    })

    it("should have no proxy host", function () {
      expect(configuration.proxy_host).equal('')
    })

    it("should have no proxy port", function () {
      expect(configuration.proxy_port).equal('')
    })

    it("should not ignore server-side configuration", function () {
      expect(configuration.ignore_server_configuration).equal(false)
    })

    it("should enable the agent", function () {
      expect(configuration.agent_enabled).equal(true)
    })

    it("should have an apdexT of 0.1", function () {
      expect(configuration.apdex_t).equal(0.1)
    })

    it("should not capture request parameters", function () {
      expect(configuration.capture_params).equal(false)
    })

    it("should have no ignored request parameters", function () {
      expect(configuration.ignored_params).eql([])
    })

    it("should log at the info level", function () {
      expect(configuration.logging.level).equal('info')
    })

    it("should have a log filepath of process.cwd + newrelic_agent.log", function () {
      var logPath = path.join(process.cwd(), 'newrelic_agent.log')
      expect(configuration.logging.filepath).equal(logPath)
    })

    it("should enable the error collector", function () {
      expect(configuration.error_collector.enabled).equal(true)
    })

    it("should ignore status code 404", function () {
      expect(configuration.error_collector.ignore_status_codes).eql([404])
    })

    it("should enable the transaction tracer", function () {
      expect(configuration.transaction_tracer.enabled).equal(true)
    })

    it("should set the transaction tracer threshold to 'apdex_f'", function () {
      expect(configuration.transaction_tracer.transaction_threshold).equal('apdex_f')
    })

    it("should collect one slow transaction trace per harvest cycle", function () {
      expect(configuration.transaction_tracer.top_n).equal(20)
    })

    it("should not debug internal metrics", function () {
      expect(configuration.debug.internal_metrics).equal(false)
    })

    it("REALLY should not trace the transaction tracer", function () {
      expect(configuration.debug.tracer_tracing).equal(false)
    })

    it("should have no naming rules", function () {
      expect(configuration.rules.name.length).equal(0)
    })

    it("should have no ignoring rules", function () {
      expect(configuration.rules.ignore.length).equal(0)
    })

    it("should enforce URL backstop", function () {
      expect(configuration.enforce_backstop).equal(true)
    })

    it("should allow passed-in config to override errors ignored", function () {
      configuration = Config.initialize({
        error_collector : {
          ignore_status_codes : []
        }
      })

      expect(configuration.error_collector.ignore_status_codes).eql([])
    })
  })

  describe("when overriding the config file location via NR_HOME", function () {
    var origHome
      , startDir
      , DESTDIR = path.join(__dirname, 'xXxNRHOMETESTxXx')
      , NOPLACEDIR = path.join(__dirname, 'NOHEREHERECHAMP')
      , CONFIGPATH = path.join(DESTDIR, 'newrelic.js')


    beforeEach(function (done) {
      if (process.env.NEW_RELIC_HOME) {
        origHome = process.env.NEW_RELIC_HOME
      }

      startDir = process.cwd()

      fs.mkdir(DESTDIR, function (error) {
        if (error) return done(error)

        fs.mkdir(NOPLACEDIR, function (error) {
          if (error) return done(error)

          process.chdir(NOPLACEDIR)
          process.env.NEW_RELIC_HOME = DESTDIR

          var sampleConfig = fs.createReadStream(path.join(__dirname, '../../lib/config.default.js'))
          var sandboxedConfig = fs.createWriteStream(CONFIGPATH)
          sampleConfig.pipe(sandboxedConfig)

          sandboxedConfig.on('close', function () { return done(); })
        })
      })
    })

    afterEach(function (done) {
      if (origHome) {
        process.env.NEW_RELIC_HOME = origHome
      }
      else {
        delete process.env.NEW_RELIC_HOME
      }
      origHome = null

      fs.unlink(CONFIGPATH, function (error) {
        if (error) return done(error)

        fs.rmdir(DESTDIR, function (error) {
          if (error) return done(error)

          process.chdir(startDir)

          fs.rmdir(NOPLACEDIR, done)
        })
      })
    })

    it("should load the configuration", function () {
      expect(function () { Config.initialize(); }).not.throws()
    })

    it("should export the home directory on the resulting object", function () {
      var configuration = Config.initialize()
      expect(configuration.newrelic_home).equal(DESTDIR)
    })

    it("should ignore the configuration file completely when so directed", function () {
      process.env.NEW_RELIC_NO_CONFIG_FILE = 'true'
      process.env.NEW_RELIC_HOME = '/xxxnoexist/nofile'

      var configuration
      expect(function envTest() {
        configuration = Config.initialize()
      }).not.throws()

      should.not.exist(configuration.newrelic_home)
      expect(configuration.error_collector &&
             configuration.error_collector.enabled).equal(true)

      delete process.env.NEW_RELIC_NO_CONFIG_FILE
      delete process.env.NEW_RELIC_HOME
    })
  })

  describe("when receiving server-side configuration", function () {
    var config

    beforeEach(function () {
      config = new Config()
    })

    it("should set the agent run ID", function () {
      config.onConnect({'agent_run_id' : 1234})
      expect(config.run_id).equal(1234)
    })

    it("should set the application ID", function () {
      config.onConnect({'application_id' : 76543})
      expect(config.application_id).equal(76543)
    })

    it("should always respect collect_traces", function () {
      expect(config.collect_traces).equal(true)
      config.onConnect({'collect_traces' : false})
      expect(config.collect_traces).equal(false)
    })

    it("should disable the transaction tracer when told to", function () {
      expect(config.transaction_tracer.enabled).equal(true)
      config.onConnect({'transaction_tracer.enabled' : false})
      expect(config.transaction_tracer.enabled).equal(false)
    })

    it("should always respect collect_errors", function () {
      expect(config.collect_errors).equal(true)
      config.onConnect({'collect_errors' : false})
      expect(config.collect_errors).equal(false)
    })

    it("should disable the error tracer when told to", function () {
      expect(config.error_collector.enabled).equal(true)
      config.onConnect({'error_collector.enabled' : false})
      expect(config.error_collector.enabled).equal(false)
    })

    it("should set apdex_t", function () {
      expect(config.apdex_t).equal(0.1)
      config.on('apdex_t', function (value) { expect(value).equal(0.05); })
      config.onConnect({'apdex_t' : 0.05})
      expect(config.apdex_t).equal(0.05)
    })

    it("should map transaction_tracer.transaction_threshold", function () {
      expect(config.transaction_tracer.transaction_threshold).equal('apdex_f')
      config.onConnect({'transaction_tracer.transaction_threshold' : 0.75})
      expect(config.transaction_tracer.transaction_threshold).equal(0.75)
    })

    it("should map URL rules to the URL normalizer", function (done) {
      config.on('url_rules', function (rules) {
        expect(rules).eql([{name : 'sample_rule'}])
        done()
      })

      config.onConnect({'url_rules' : [{name : 'sample_rule'}]})
    })

    it("should map metric naming rules to the metric name normalizer", function (done) {
      config.on('metric_name_rules', function (rules) {
        expect(rules).eql([{name : 'sample_rule'}])
        done()
      })

      config.onConnect({'metric_name_rules' : [{name : 'sample_rule'}]})
    })

    it("should map transaction naming rules to the transaction name normalizer",
       function (done) {
      config.on('transaction_name_rules', function (rules) {
        expect(rules).eql([{name : 'sample_rule'}])
        done()
      })

      config.onConnect({'transaction_name_rules' : [{name : 'sample_rule'}]})
    })

    it("should log the product level", function () {
      expect(config.product_level).equal(0)
      config.onConnect({'product_level' : 30})
      expect(config.product_level).equal(30)
    })

    it("should reject high_security", function () {
      config.onConnect({'high_security' : true})
      expect(config.high_security).equal(false)
    })

    it("should configure param capture", function () {
      expect(config.capture_params).equal(false)
      config.onConnect({'capture_params' : true})
      expect(config.capture_params).equal(true)
    })

    it("should configure ignored params", function () {
      expect(config.ignored_params).eql([])
      config.onConnect({'ignored_params' : ['a', 'b']})
      expect(config.ignored_params).eql(['a', 'b'])
    })

    it("should configure ignored params without stomping local config", function () {
      config.ignored_params = ['b', 'c']

      config.onConnect({'ignored_params' : ['a', 'b']})
      expect(config.ignored_params).eql(['b', 'c', 'a'])
    })

    describe("when handling embedded agent_config", function () {
      it("shouldn't blow up when agent_config is passed in", function () {
        expect(function () {
          config.onConnect({'agent_config' : {}})
        }).not.throws()
      })

      it("should ignore status codes set on the server", function () {
        config.onConnect({'agent_config' : {
          'error_collector.ignore_status_codes' : [401, 409, 415]
        }})
        expect(config.error_collector.ignore_status_codes).eql([404, 401, 409, 415])
      })

      it("should ignore status codes set on the server as strings", function () {
        config.onConnect({'agent_config' : {
          'error_collector.ignore_status_codes' : ['401', '409', '415']
        }})
        expect(config.error_collector.ignore_status_codes).eql([404, 401, 409, 415])
      })
    })

    it("should load named transaction apdexes", function () {
      var apdexes = {"WebTransaction/Custom/UrlGenerator/en/betting/Football" : 7.0}
      expect(config.web_transactions_apdex).eql({})
      config.onConnect({'web_transactions_apdex' : apdexes})
      expect(config.web_transactions_apdex).eql(apdexes)
    })

    it("shouldn't blow up when sampling_rate is received", function () {
      expect(function () {
        config.onConnect({'sampling_rate' : 0})
      }).not.throws()
    })

    it("shouldn't blow up when cross_process_id is received", function () {
      expect(function () {
        config.onConnect({'cross_process_id' : 'junk'})
      }).not.throws()
    })

    it("shouldn't blow up when cross_application_tracing is received", function () {
      expect(function () {
        config.onConnect({'cross_application_tracing' : true})
      }).not.throws()
    })

    it("shouldn't blow up when encoding_key is received", function () {
      expect(function () {
        config.onConnect({'encoding_key' : 'hamsnadwich'})
      }).not.throws()
    })

    it("shouldn't blow up when trusted_account_ids is received", function () {
      expect(function () {
        config.onConnect({'trusted_account_ids' : [1, 2, 3]})
      }).not.throws()
    })

    it("shouldn't blow up when high_security is received", function () {
      expect(function () {
        config.onConnect({'high_security' : true})
      }).not.throws()
    })

    it("shouldn't blow up when ssl is received", function () {
      expect(function () {
        config.onConnect({'ssl' : true})
      }).not.throws()
    })

    it("shouldn't blow up when transaction_tracer.record_sql is received", function () {
      expect(function () {
        config.onConnect({'transaction_tracer.record_sql' : true})
      }).not.throws()
    })

    it("shouldn't blow up when slow_sql.enabled is received", function () {
      expect(function () {
        config.onConnect({'slow_sql.enabled' : true})
      }).not.throws()
    })

    it("shouldn't blow up when rum.load_episodes_file is received", function () {
      expect(function () {
        config.onConnect({'rum.load_episodes_file' : true})
      }).not.throws()
    })

    it("shouldn't blow up when beacon is received", function () {
      expect(function () {
        config.onConnect({'beacon' : 'beacon-0.newrelic.com'})
      }).not.throws()
    })

    it("shouldn't blow up when beacon is received", function () {
      expect(function () {
        config.onConnect({'error_beacon' : null})
      }).not.throws()
    })

    it("shouldn't blow up when js_agent_file is received", function () {
      expect(function () {
        config.onConnect({'js_agent_file' : 'jxc4afffef.js'})
      }).not.throws()
    })

    it("shouldn't blow up when js_agent_loader_file is received", function () {
      expect(function () {
        config.onConnect({'js_agent_loader_file' : 'nr-js-bootstrap.js'})
      }).not.throws()
    })

    it("shouldn't blow up when episodes_file is received", function () {
      expect(function () {
        config.onConnect({'episodes_file' : 'js-agent.newrelic.com/nr-100.js'})
      }).not.throws()
    })

    it("shouldn't blow up when episodes_url is received", function () {
      expect(function () {
        config.onConnect({'episodes_url' : 'https://js-agent.newrelic.com/nr-100.js'})
      }).not.throws()
    })

    it("shouldn't blow up when browser_key is received", function () {
      expect(function () {
        config.onConnect({'browser_key' : 'beefchunx'})
      }).not.throws()
    })

    it("shouldn't blow up when collect_analytics_events is received",
    function () {
      config.transaction_events.enabled = true
      expect(function () {
        config.onConnect({'collect_analytics_events' : false})
      }).not.throws()
      expect(config.transaction_events.enabled).equals(false)
    })

    it("shouldn't blow up when transaction_events.max_samples_stored is received",
    function () {
      expect(function () {
        config.onConnect({'transaction_events.max_samples_stored' : 10})
      }).not.throws()
      expect(config.transaction_events.max_samples_stored).equals(10)
    })

    it("shouldn't blow up when transaction_events.max_samples_per_minute is received",
    function () {
      expect(function () {
        config.onConnect({'transaction_events.max_samples_per_minute' : 1})
      }).not.throws()
      expect(config.transaction_events.max_samples_per_minute).equals(1)
    })

    it("shouldn't blow up when transaction_events.enabled is received", function () {
      expect(function () {
        config.onConnect({'transaction_events.enabled' : false})
      }).not.throws()
      expect(config.transaction_events.enabled).equals(false)
    })

    describe("when data_report_period is set", function () {
      it("should emit 'data_report_period' when harvest interval is changed",
         function (done) {
        config.once('data_report_period', function (harvestInterval) {
          expect(harvestInterval).equal(45)

          done()
        })

        config.onConnect({'data_report_period' : 45})
      })

      it("should update data_report_period only when it is changed", function () {
        expect(config.data_report_period).equal(60)

        config.once('data_report_period', function () {
          throw new Error('should never get here')
        })

        config.onConnect({'data_report_period' : 60})
      })
    })

    describe("when apdex_t is set", function () {
      it("should emit 'apdex_t' when apdex_t changes", function (done) {
        config.once('apdex_t', function (apdexT) {
          expect(apdexT).equal(0.75)

          done()
        })

        config.onConnect({'apdex_t' : 0.75})
      })

      it("should update its apdex_t only when it has changed", function () {
        expect(config.apdex_t).equal(0.1)

        config.once('apdex_t', function () {
          throw new Error('should never get here')
        })

        config.onConnect({'apdex_t' : 0.1})
      })
    })
  })

  describe("when receiving server-side configuration while it's disabled", function () {
    var config

    beforeEach(function () {
      config = new Config()
      config.ignore_server_configuration = true
    })

    it("should still set rum properties", function () {
      config.onConnect({
        js_agent_loader      : "LOADER",
        js_agent_file        : "FILE",
        js_agent_loader_file : "LOADER_FILE",
        beacon               : "BEACON",
        error_beacon         : "ERR_BEACON",
        browser_key          : "KEY"
      })
      var bm = config.browser_monitoring

      expect(bm.js_agent_loader)      .equal ("LOADER")
      expect(bm.js_agent_file)        .equal ("FILE")
      expect(bm.js_agent_loader_file) .equal ("LOADER_FILE")
      expect(bm.beacon)               .equal ("BEACON")
      expect(bm.error_beacon)         .equal ("ERR_BEACON")
      expect(bm.browser_key)          .equal ("KEY")
    })

    it("should still set agent_run_id", function () {
      config.onConnect({'agent_run_id' : 1234})
      expect(config.run_id).equal(1234)
    })

    it("should always respect collect_traces", function () {
      expect(config.collect_traces).equal(true)
      config.onConnect({'collect_traces' : false})
      expect(config.collect_traces).equal(false)
    })

    it("should always respect collect_errors", function () {
      expect(config.collect_errors).equal(true)
      config.onConnect({'collect_errors' : false})
      expect(config.collect_errors).equal(false)
    })

    it("should still log product_level", function () {
      expect(config.product_level).equal(0)
      config.onConnect({'product_level' : 30})
      expect(config.product_level).equal(30)
    })

    it("should still pass url_rules to the URL normalizer", function (done) {
      config.on('url_rules', function (rules) {
        expect(rules).eql([{name : 'sample_rule'}])
        done()
      })

      config.onConnect({'url_rules' : [{name : 'sample_rule'}]})
    })

    it("should still pass metric_name_rules to the metric name normalizer",
       function (done) {
      config.on('metric_name_rules', function (rules) {
        expect(rules).eql([{name : 'sample_rule'}])
        done()
      })

      config.onConnect({'metric_name_rules' : [{name : 'sample_rule'}]})
    })

    it("should still pass transaction_name_rules to the transaction name normalizer",
       function (done) {
      config.on('transaction_name_rules', function (rules) {
        expect(rules).eql([{name : 'sample_rule'}])
        done()
      })

      config.onConnect({'transaction_name_rules' : [{name : 'sample_rule'}]})
    })

    it("shouldn't configure apdex_t", function () {
      expect(config.apdex_t).equal(0.1)
      config.on('apdex_t', function () { throw new Error("shouldn't happen"); })
      config.onConnect({'apdex_t' : 0.05})
      expect(config.apdex_t).equal(0.1)
    })

    it("shouldn't configure named transaction apdexes", function () {
      var apdexes = {"WebTransaction/Custom/UrlGenerator/en/betting/Football" : 7.0}
      expect(config.web_transactions_apdex).eql({})
      config.onConnect({'web_transactions_apdex' : apdexes})
      expect(config.web_transactions_apdex).eql({})
    })

    it("shouldn't configure data_report_period", function () {
      expect(config.data_report_period).equal(60)
      config.onConnect({'data_report_period' : 45})
      expect(config.data_report_period).equal(60)
    })

    it("shouldn't configure transaction_tracer.enabled", function () {
      expect(config.transaction_tracer.enabled).equal(true)
      config.onConnect({'transaction_tracer.enabled' : false})
      expect(config.transaction_tracer.enabled).equal(true)
    })

    it("shouldn't configure error_tracer.enabled", function () {
      expect(config.error_collector.enabled).equal(true)
      config.onConnect({'error_collector.enabled' : false})
      expect(config.error_collector.enabled).equal(true)
    })

    it("shouldn't configure transaction_tracer.transaction_threshold", function () {
      expect(config.transaction_tracer.transaction_threshold).equal('apdex_f')
      config.onConnect({'transaction_tracer.transaction_threshold' : 0.75})
      expect(config.transaction_tracer.transaction_threshold).equal('apdex_f')
    })

    it("shouldn't configure capture_params", function () {
      expect(config.capture_params).equal(false)
      config.onConnect({'capture_params' : true})
      expect(config.capture_params).equal(false)
    })

    it("shouldn't configure ignored_params", function () {
      expect(config.ignored_params).eql([])
      config.onConnect({'ignored_params' : ['a', 'b']})
      expect(config.ignored_params).eql([])
    })

    it("should ignore sampling_rate", function () {
      expect(function () {
        config.onConnect({'sampling_rate' : 0})
      }).not.throws()
    })

    it("should ignore ssl", function () {
      expect(config.ssl).eql(true)
      expect(function () {
        config.onConnect({'ssl' : false})
      }).not.throws()
      expect(config.ssl).eql(true)
    })

    it("should ignore cross_process_id", function () {
      expect(function () {
        config.onConnect({'cross_process_id' : 'junk'})
      }).not.throws()
    })

    it("should ignore cross_application_tracing", function () {
      expect(function () {
        config.onConnect({'cross_application_tracing' : true})
      }).not.throws()
    })

    it("should ignore encoding_key", function () {
      expect(function () {
        config.onConnect({'encoding_key' : true})
      }).not.throws()
    })

    it("should ignore trusted_account_ids", function () {
      expect(function () {
        config.onConnect({'trusted_account_ids' : [1, 2, 3]})
      }).not.throws()
    })

    it("should ignore transaction_tracer.record_sql", function () {
      expect(function () {
        config.onConnect({'transaction_tracer.record_sql' : true})
      }).not.throws()
    })

    it("should ignore slow_sql.enabled", function () {
      expect(function () {
        config.onConnect({'slow_sql.enabled' : true})
      }).not.throws()
    })

    it("should ignore rum.load_episodes_file", function () {
      expect(function () {
        config.onConnect({'rum.load_episodes_file' : true})
      }).not.throws()
    })
  })
})
