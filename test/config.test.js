'use strict';

var path   = require('path')
  , chai   = require('chai')
  , should = chai.should()
  , expect = chai.expect
  , util   = require('util')
  , fs     = require('fs')
  , logger = require(path.join(__dirname, '..', 'lib', 'logger')).child({component : 'TEST'})
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
    var c = config.initialize(logger, {config : {'agent_enabled' : false}});
    c.agent_enabled.should.equal(false);
  });

  describe("when overriding configuration values via environment variables", function () {
    it("should pick up the application name", function () {
      idempotentEnv('NR_APP_NAME', 'feeling testy,and schizophrenic', function (tc) {
        should.exist(tc.app_name);
        expect(tc.app_name).eql(['feeling testy', 'and schizophrenic']);
      });
    });

    it("should pick up the license key", function () {
      idempotentEnv('NR_LICENSE_KEY', 'hambulance', function (tc) {
        should.exist(tc.license_key);
        expect(tc.license_key).equal('hambulance');
      });
    });

    it("should pick up the collector host", function () {
      idempotentEnv('NR_COLLECTOR_HOST', 'localhost', function (tc) {
        should.exist(tc.host);
        expect(tc.host).equal('localhost');
      });
    });

    it("should pick up the collector port", function () {
      idempotentEnv('NR_COLLECTOR_PORT', 7777, function (tc) {
        should.exist(tc.port);
        expect(tc.port).equal('7777');
      });
    });

    it("should pick up the log level", function () {
      idempotentEnv('NR_LOGGING_LEVEL', 'XXNOEXIST', function (tc) {
        should.exist(tc.logging.level);
        expect(tc.logging.level).equal('XXNOEXIST');
      });
    });

    it("should pick up the log filepath", function () {
      idempotentEnv('NR_LOGGING_FILEPATH', '/highway/to/the/danger/zone', function (tc) {
        should.exist(tc.logging.filepath);
        expect(tc.logging.filepath).equal('/highway/to/the/danger/zone');
      });
    });

    it("should pick up whether the agent is enabled", function () {
      idempotentEnv('NR_AGENT_ENABLED', 0, function (tc) {
        should.exist(tc.agent_enabled);
        expect(tc.agent_enabled).equal(false);
      });
    });

    it("should pick up whether the error collector is enabled", function () {
      idempotentEnv('NR_ERROR_COLLECTOR_ENABLED', 'NO', function (tc) {
        should.exist(tc.error_collector.enabled);
        expect(tc.error_collector.enabled).equal(false);
      });
    });

    it("should pick up which status codes are ignored", function () {
      idempotentEnv('NR_ERROR_COLLECTOR_IGNORE_STATUS_CODES', '401,404,502', function (tc) {
        should.exist(tc.error_collector.ignore_status_codes);
        expect(tc.error_collector.ignore_status_codes).eql(['401', '404', '502']);
      });
    });

    it("should pick up whether the transaction tracer is enabled", function () {
      idempotentEnv('NR_TRANSACTION_TRACER_ENABLED', false, function (tc) {
        should.exist(tc.transaction_tracer.enabled);
        expect(tc.transaction_tracer.enabled).equal(false);
      });
    });

    it("should pick up the transaction trace threshold", function () {
      idempotentEnv('NR_TRANSACTION_TRACER_TRACE_THRESHOLD', 0.02, function (tc) {
        should.exist(tc.transaction_tracer.trace_threshold);
        expect(tc.transaction_tracer.trace_threshold).equal('0.02');
      });
    });

    it("should pick up whether internal metrics are enabled", function () {
      idempotentEnv('NR_DEBUG_INTERNAL_METRICS', true, function (tc) {
        should.exist(tc.debug.internal_metrics);
        expect(tc.debug.internal_metrics).equal(true);
      });
    });

    it("should pick up whether tracing of the transaction tracer is enabled", function () {
      idempotentEnv('NR_DEBUG_TRACER_TRACING', 'yup', function (tc) {
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

    it("should log at the info level by default", function () {
      configuration.logging.level.should.equal('info');
    });

    it("should have a blank default log filepath", function () {
      configuration.logging.filepath.should.equal('');
    });

    it("should enable the agent by default", function () {
      configuration.agent_enabled.should.equal(true);
    });

    it("should enable the error collector by default", function () {
      configuration.error_collector.enabled.should.equal(true);
    });

    it("should ignore status code 404 by default", function () {
      configuration.error_collector.ignore_status_codes.should.eql([404]);
    });

    it("should enable the transaction tracer by default", function () {
      configuration.transaction_tracer.enabled.should.equal(true);
    });

    it("should set the transaction tracer threshold to 'apdex_f' by default", function () {
      configuration.transaction_tracer.trace_threshold.should.equal('apdex_f');
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
      if (process.env.NEWRELIC_HOME) {
        origHome = process.env.NEWRELIC_HOME;
      }

      startDir = process.cwd();

      fs.mkdir(DESTDIR, function (error) {
        if (error) return done(error);

        fs.mkdir(NOPLACEDIR, function (error) {
          if (error) return done(error);

          process.chdir(NOPLACEDIR);
          process.env.NEWRELIC_HOME = DESTDIR;

          var sampleConfig = fs.createReadStream(path.join(__dirname, '..', 'lib', 'config.default.js'));
          var sandboxedConfig = fs.createWriteStream(CONFIGPATH);
          sampleConfig.pipe(sandboxedConfig);

          return done();
        });
      });
    });

    afterEach(function (done) {
      if (origHome) {
        process.env.NEWRELIC_HOME = origHome;
      }
      else {
        delete process.env.NEWRELIC_HOME;
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

    it("should expose the location of the overridden configuration on the resulting object", function () {
      var configuration = config.initialize(logger);
      configuration.newrelic_home.should.equal(DESTDIR);
    });
  });
});
