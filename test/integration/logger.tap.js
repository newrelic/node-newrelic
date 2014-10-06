'use strict'

var path   = require ('path')
  , fs     = require('fs')
  , tap    = require('tap')
  , test   = tap.test
  , wrench = require('wrench')
  , exists = fs.existsSync || path.existsSync
  

var DIRNAME = 'XXXNOCONFTEST'

test("logger configuration from environment", function (t) {
  this.tearDown(function cb_tearDown() {
    if (path.basename(process.cwd()) === DIRNAME) process.chdir('..')
    if (exists(path.join(process.cwd(), DIRNAME))) wrench.rmdirSyncRecursive(DIRNAME)
  })

  fs.mkdir(DIRNAME, function (error) {
    if (error) {
      t.fail("couldn't make directory: %s", error)
      return t.end()
    }

    process.chdir(DIRNAME)

    process.env.NEW_RELIC_LOG = 'stdout'
    process.env.NEW_RELIC_NO_CONFIG_FILE = '1'

    try {
      t.ok(require('../../lib/logger'),
           "requiring logger returned a logging object")
    }
    catch (error) {
      t.fail("loading logger failed: %s", error)
    }

    t.end()
  })
})
