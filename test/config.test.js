'use strict';

var path   = require('path')
  , chai   = require('chai')
  , should = chai.should()
  , expect = chai.expect
  , fs     = require('fs')
  , logger = require(path.join(__dirname, '..',
                               'lib', 'logger')).child({component : 'TEST'})
  , config = require(path.join(__dirname, '..', 'lib', 'config'))
  ;

function idempotentEnv(name, value, callback) {
  var is, saved;

  // process.env is not a normal object
  if (Object.hasOwnProperty.call(process.env, name)) {
    is = true;
    saved = process.env[name];
  }

  process.env[name] = value;
  try {
    var tc = config.initialize(logger);
    callback(tc);
  }
  catch (error) {
    throw error;
  }
  finally {
    if (is) {
      process.env[name] = saved;
    }
    else {
      delete process.env[name];
    }
  }
}

describe("the agent configuration", function () {
  it("should handle a directly passed minimal configuration", function () {
    var c;
    expect(function testInitialize() {
      c = config.initialize(logger, {config : {}});
    }).not.throws();
    c.agent_enabled.should.equal(true);
  });

  describe("when overriding configuration values via environment variables", function () {
    it("should pick up the application name", function () {
      idempotentEnv('NEW_RELIC_APP_NAME', 'feeling testy,and schizophrenic',
                    function (tc) {
        should.exist(tc.app_name);
        expect(tc.app_name).eql(['feeling testy', 'and schizophrenic']);
      });
    });

    it("should pick up the license key", function () {
      idempotentEnv('NEW_RELIC_LICENSE_KEY', 'hambulance', function (tc) {
        should.exist(tc.license_key);
        expect(tc.license_key).equal('hambulance');
      });
    });

    it("should pick up the collector host", function () {
      idempotentEnv('NEW_RELIC_HOST', 'localhost', function (tc) {
        should.exist(tc.host);
        expect(tc.host).equal('localhost');
      });
    });

    it("should pick up the collector port", function () {
      idempotentEnv('NEW_RELIC_PORT', 7777, function (tc) {
        should.exist(tc.port);
        expect(tc.port).equal('7777');
      });
    });

    it("should pick up the proxy host", function () {
      idempotentEnv('NEW_RELIC_PROXY_HOST', 'proxyhost', function (tc) {
        should.exist(tc.proxy_host);
        expect(tc.proxy_host).equal('proxyhost');
      });
    });

    it("should pick up the proxy port", function () {
      idempotentEnv('NEW_RELIC_PROXY_PORT', 7777, function (tc) {
        should.exist(tc.proxy_port);
        expect(tc.proxy_port).equal('7777');
      });
    });

    it("should pick up the log level", function () {
      idempotentEnv('NEW_RELIC_LOG_LEVEL', 'XXNOEXIST', function (tc) {
        should.exist(tc.logging.level);
        expect(tc.logging.level).equal('XXNOEXIST');
      });
    });

    it("should pick up the log filepath", function () {
      idempotentEnv('NEW_RELIC_LOG', '/highway/to/the/danger/zone', function (tc) {
        should.exist(tc.logging.filepath);
        expect(tc.logging.filepath).equal('/highway/to/the/danger/zone');
      });
    });

    it("should pick up whether the agent is enabled", function () {
      idempotentEnv('NEW_RELIC_ENABLED', 0, function (tc) {
        should.exist(tc.agent_enabled);
        expect(tc.agent_enabled).equal(false);
      });
    });

    it("should pick up whether the apdexT is set", function () {
      idempotentEnv('NEW_RELIC_APDEX', 0.666, function (tc) {
        should.exist(tc.apdex_t);
        expect(tc.apdex_t).equal('0.666');
      });
    });

    it("should pick up whether the error collector is enabled", function () {
      idempotentEnv('NEW_RELIC_ERROR_COLLECTOR_ENABLED', 'NO', function (tc) {
        should.exist(tc.error_collector.enabled);
        expect(tc.error_collector.enabled).equal(false);
      });
    });

    it("should pick up which status codes are ignored", function () {
      idempotentEnv('NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES',
                    '401,404,502', function (tc) {
        should.exist(tc.error_collector.ignore_status_codes);
        expect(tc.error_collector.ignore_status_codes).eql(['401', '404', '502']);
      });
    });

    it("should pick up whether the transaction tracer is enabled", function () {
      idempotentEnv('NEW_RELIC_TRACER_ENABLED', false, function (tc) {
        should.exist(tc.transaction_tracer.enabled);
        expect(tc.transaction_tracer.enabled).equal(false);
      });
    });

    it("should pick up the transaction trace threshold", function () {
      idempotentEnv('NEW_RELIC_TRACER_THRESHOLD', 0.02, function (tc) {
        should.exist(tc.transaction_tracer.trace_threshold);
        expect(tc.transaction_tracer.trace_threshold).equal('0.02');
      });
    });

    it("should pick up the transaction trace Top N scale", function () {
      idempotentEnv('NEW_RELIC_TRACER_TOP_N', 20, function (tc) {
        should.exist(tc.transaction_tracer.trace_threshold);
        expect(tc.transaction_tracer.top_n).equal('20');
      });
    });

    it("should pick up whether internal metrics are enabled", function () {
      idempotentEnv('NEW_RELIC_DEBUG_METRICS', true, function (tc) {
        should.exist(tc.debug.internal_metrics);
        expect(tc.debug.internal_metrics).equal(true);
      });
    });

    it("should pick up whether tracing of the transaction tracer is enabled",
       function () {
      idempotentEnv('NEW_RELIC_DEBUG_TRACER', 'yup', function (tc) {
        should.exist(tc.debug.tracer_tracing);
        expect(tc.debug.tracer_tracing).equal(true);
      });
    });
  });

  describe("with default properties", function () {
    var configuration;

    before(function () {
      configuration = config.initialize(logger, {config : {}});

      // ensure environment is clean
      delete configuration.newrelic_home;
    });

    it("should have an app name of ['MyApplication']", function () {
      configuration.app_name.should.eql(['MyApplication']);
    });

    it("should connect to the collector at collector.newrelic.com", function () {
      configuration.host.should.equal('collector.newrelic.com');
    });

    it("should connect to the collector on port 80", function () {
      configuration.port.should.equal(80);
    });

    it("should have no proxy host", function () {
      configuration.proxy_host.should.equal('');
    });

    it("should have no proxy port", function () {
      configuration.proxy_port.should.equal('');
    });

    it("should log at the info level", function () {
      configuration.logging.level.should.equal('info');
    });

    it("should have a log filepath of process.cwd + newrelic_agent.log", function () {
      var logPath = path.join(process.cwd(), 'newrelic_agent.log');
      configuration.logging.filepath.should.equal(logPath);
    });

    it("should enable the agent", function () {
      configuration.agent_enabled.should.equal(true);
    });

    it("should have an apdexT of 0.5", function () {
      configuration.apdex_t.should.equal(0.5);
    });

    it("should enable the error collector", function () {
      configuration.error_collector.enabled.should.equal(true);
    });

    it("should ignore status code 404", function () {
      configuration.error_collector.ignore_status_codes.should.eql([404]);
    });

    it("should enable the transaction tracer", function () {
      configuration.transaction_tracer.enabled.should.equal(true);
    });

    it("should set the transaction tracer threshold to 'apdex_f'", function () {
      configuration.transaction_tracer.trace_threshold.should.equal('apdex_f');
    });

    it("should collect one slow transaction trace per harvest cycle", function () {
      configuration.transaction_tracer.top_n.should.equal(1);
    });
  });

  describe("when overriding the config file location via NR_HOME", function () {
    var origHome
      , startDir
      , DESTDIR = path.join(__dirname, 'xXxNRHOMETESTxXx')
      , NOPLACEDIR = path.join(__dirname, 'NOHEREHERECHAMP')
      , CONFIGPATH = path.join(DESTDIR, 'newrelic.js')
      ;

    beforeEach(function (done) {
      if (process.env.NEW_RELIC_HOME) {
        origHome = process.env.NEW_RELIC_HOME;
      }

      startDir = process.cwd();

      fs.mkdir(DESTDIR, function (error) {
        if (error) return done(error);

        fs.mkdir(NOPLACEDIR, function (error) {
          if (error) return done(error);

          process.chdir(NOPLACEDIR);
          process.env.NEW_RELIC_HOME = DESTDIR;

          var sampleConfig = fs.createReadStream(path.join(__dirname, '..',
                                                           'lib', 'config.default.js'));
          var sandboxedConfig = fs.createWriteStream(CONFIGPATH);
          sampleConfig.pipe(sandboxedConfig);

          sandboxedConfig.on('close', function () { return done(); });
        });
      });
    });

    afterEach(function (done) {
      if (origHome) {
        process.env.NEW_RELIC_HOME = origHome;
      }
      else {
        delete process.env.NEW_RELIC_HOME;
      }
      origHome = null;

      fs.unlink(CONFIGPATH, function (error) {
        if (error) return done(error);

        fs.rmdir(DESTDIR, function (error) {
          if (error) return done(error);

          process.chdir(startDir);

          fs.rmdir(NOPLACEDIR, done);
        });
      });
    });

    it("should load the configuration", function () {
      expect(function () { config.initialize(logger); }).not.throws();
    });

    it("should export the home directory on the resulting object", function () {
      var configuration = config.initialize(logger);
      configuration.newrelic_home.should.equal(DESTDIR);
    });

    it("should ignore the configuration file completely when so directed", function () {
      process.env.NEW_RELIC_NO_CONFIG_FILE = 'true';
      process.env.NEW_RELIC_HOME = '/xxxnoexist/nofile';

      var configuration;
      expect(function envTest() {
        configuration = config.initialize(logger);
      }).not.throws();

      should.not.exist(configuration.newrelic_home);
      expect(configuration.error_collector &&
             configuration.error_collector.enabled).equal(true);
    });
  });
});
