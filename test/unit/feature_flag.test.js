var flags = require('../../lib/feature_flags.js')
var chai  = require('chai')
var assert= require('assert')
var Config= require('../../lib/config')

chai.should()

// please do not delete flags from here
var used = [
  'cat',
  'custom_events',
  'custom_instrumentation',
  'custom_metrics',
  'express4',
  'express5',
  'insights',
  'mysql_pool',
  'postgres',
  'proxy',
  'released',
  'synthetics',
  'unreleased',
]

describe("feature flags", function () {
  var prerelease, unreleased, released

  before(function(){
    prerelease = Object.keys(flags.prerelease)
    unreleased = flags.unreleased
    released   = flags.released
  })

  it("should declare every prerelease feature in the *used* variable", function () {
    prerelease.forEach(function cb_forEach(key) {
      assert(used.indexOf(key) >= 0)
    })
  })
  it("should declare every release feature in the *used* variable", function () {
    released.forEach(function cb_forEach(key) {
      assert(used.indexOf(key) >= 0)
    })
  })
  it("should declare every unrelease feature in the *used* variable", function () {
    unreleased.forEach(function cb_forEach(key) {
      assert(used.indexOf(key) >= 0)
    })
  })
  it("should not re-declare a flag in prerelease from released", function () {
    prerelease.filter(function cb_filter(n) {
      return released.indexOf(n) !== -1
    }).length.should.equal(0)
  })
  it("should not re-declare a flag in prerelease from unreleased", function () {
    Object.keys(flags.prerelease).filter(function cb_filter(n) {
      return unreleased.indexOf(n) !== -1
    }).length.should.equal(0)
  })
  it("should account for all *used* keys", function () {
    used.forEach(function(key){
      if (released  .indexOf(key) >= 0) return
      if (unreleased.indexOf(key) >= 0) return
      if (prerelease.indexOf(key) >= 0) return

      throw new Error('Flag not accounted for')
    })
  })
  it("should warn if released flags are still in config", function () {
    Config.prototype.setLogger({
      warn: function(){ called = true; }
    })
    var called = false
    var config = new Config()
    config.feature_flag.released = true
    config.validateFlags()
    called.should.equal(true)
  })
  it("should warn if unreleased flags are still in config", function () {
    Config.prototype.setLogger({
      warn: function(){ called = true; }
    })
    var called = false
    var config = new Config()
    config.feature_flag.unreleased = true
    config.validateFlags()
    called.should.equal(true)
  })
})
