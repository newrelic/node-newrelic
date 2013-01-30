'use strict';

var path   = require ('path')
  , fs     = require('fs')
  , domain = require('domain')
  , tap    = require('tap')
  , test   = tap.test
  , wrench = require('wrench')
  , exists = fs.existsSync || path.existsSync
  ;

var DIRNAME = 'XXXNOCONFTEST';

test("logger configuration from environment", function (t) {
  this.tearDown(function () {
    if (path.basename(process.cwd()) === DIRNAME) process.chdir('..');
    if (exists(path.join(process.cwd(), DIRNAME))) wrench.rmdirSyncRecursive(DIRNAME);
  });

  var d = domain.create();
  d.on('error', function (error) {
    t.fail(error);
    t.end();
  });

  d.run(function () {
    fs.mkdir(DIRNAME, d.intercept(function () {
      process.chdir(DIRNAME);

      process.env.NEW_RELIC_LOG = 'stdout';
      process.env.NEW_RELIC_NO_CONFIG_FILE = '1';

      t.ok(require(path.join(__dirname, '..', '..', 'lib', 'logger')),
           "requiring logger returned a logging object");
      t.end();
    }));
  });
});
