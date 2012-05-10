var path   = require('path')
  , util   = require('util')
  , fs     = require('fs')
  , logger = require(path.join(__dirname, '..', 'lib', 'logger'))
  , config = require(path.join(__dirname, '..', 'lib', 'config'))
  ;

describe('disabled test agent', function () {
  it('should handle a minimal configuration', function (done) {
    var c = config.initialize(logger, {config : {'agent_enabled' : false}});
    c.agent_enabled.should.equal(false);

    return done();
  });

  describe('when overriding the config file location via NR_HOME', function () {
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

          util.pump(sampleConfig, sandboxedConfig, done);
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

    it('should load the configuration', function (done) {
      (function () { config.initialize(logger); }).should.not.throw();

      return done();
    });
  });
});
