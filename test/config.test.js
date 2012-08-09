'use strict';

var path   = require('path')
  , chai   = require('chai')
  , should = chai.should()
  , expect = chai.expect
  , util   = require('util')
  , fs     = require('fs')
  , logger = require(path.join(__dirname, '..', 'lib', 'logger'))
  , config = require(path.join(__dirname, '..', 'lib', 'config'))
  ;

describe("the agent configuration", function () {
  it("should handle a directly passed minimal configuration", function (done) {
    var c = config.initialize(logger, {config : {'agent_enabled' : false}});
    c.agent_enabled.should.equal(false);

    return done();
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

    it("should correctly expose all of the default properties", function () {
      var configuration = config.initialize(logger);

      delete configuration.newrelic_home;

      configuration.app_name.should.eql(['MyApplication']);
      configuration.host.should.equal('collector.newrelic.com');
      configuration.port.should.equal(80);
      configuration.log_level.should.equal('info');
      configuration.agent_enabled.should.equal(true);
      configuration.error_collector.enabled.should.equal(true);
      configuration.error_collector.ignore_status_codes.should.eql([404]);
      configuration.transaction_tracer.enabled.should.equal(true);
      configuration.transaction_tracer.trace_threshold.should.equal('apdex_f');
    });
  });
});
