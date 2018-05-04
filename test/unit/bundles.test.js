'use strict'

var assert = require('chai').assert
var packageJSON = require('../../package.json')
var dependencies = Object.keys(packageJSON.dependencies)
var bundled = packageJSON.bundledDependencies

// NOTE: This test is disabled due to a bug in npm. The fix for this was
// incorporated in npm 4.0.3 which shipped with Node 7.4.0.
//
// https://github.com/npm/npm/pull/14403
//
// TODO: Enable this test after deprecating Node <7.4
describe.skip('bundledDependencies in package.json', function() {
  it('should include all dependencies', function() {
    assert.deepEqual(bundled, dependencies, 'all dependencies accounted for')
  })
})
