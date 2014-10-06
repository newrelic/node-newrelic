'use strict'

var assert = require('chai').assert,
    packageJSON = require('../../package.json'),
    dependencies = Object.keys(packageJSON.dependencies),
    bundled = packageJSON.bundledDependencies
  

describe('bundledDependencies in package.json', function() {
  it('should include all dependencies', function() {
    assert.deepEqual(bundled, dependencies, 'all dependencies accounted for')
  })
})
