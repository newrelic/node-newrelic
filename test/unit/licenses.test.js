'use strict'

var assert = require('chai').assert
  , checker = require('npm-license')
  , licenses = require('./licenses')
  

describe('Agent licenses', function() {
  it('should all be accounted for in test/license.json', function(done) {
    checker.init({start: __dirname + '/../..', include: ['dependencies', 'optionalDependencies']}, function cb_checker(modules) {
      var found = {}

      // Transform to a flat key-value dictionary with only the license type info
      for (var modver in modules) {
        // Strip off version from strings like "modulename@1.4.5"
        var name = modver.split('@')[0]

        // Filter out the newrelic module entry itself
        if (name === 'newrelic') continue

        found[name] = modules[modver].licenses
      }

      assert.deepEqual(found, licenses, 'all licenses accounted for')
      done()
    })
  })
})
