'use strict'

var assert = require('chai').assert
var packageJSON = require('../../package.json')
var dependencies = Object.keys(packageJSON.dependencies)
var bundled = packageJSON.bundledDependencies

// NOTE: This test is temporarily disabled until the following npm bugfix is merged
// https://github.com/npm/npm/pull/14403
describe.skip('bundledDependencies in package.json', function() {
  it('should include all dependencies', function() {
    assert.deepEqual(bundled, dependencies, 'all dependencies accounted for')
  })
})
