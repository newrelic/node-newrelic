var flags = require('../lib/feature_flags.js');
var chai  = require('chai');
var assert= require('assert');

chai.should();

var used = [
  'express4'
];

describe("feature flags", function () {
  var prerelease, unreleased, released;

  before(function(){
    prerelease = Object.keys(flags.prerelease);
    unreleased = Object.keys(flags.unreleased);
    released   = Object.keys(flags.released);
  });

  it("should declare every prerelease feature in the *used* variable", function () {
    prerelease.forEach(function (key) {
      assert(used.indexOf(key) >= 0);
    });
  });
  it("should declare every release feature in the *used* variable", function () {
    released.forEach(function (key) {
      assert(used.indexOf(key) >= 0);
    });
  });
  it("should declare every unrelease feature in the *used* variable", function () {
    unreleased.forEach(function (key) {
      assert(used.indexOf(key) >= 0);
    });
  });
  it("should not re-declare a flag in prerelease from released", function () {
    prerelease.filter(function (n) {
      return released.indexOf(n) !== -1;
    }).length.should.equal(0);
  });
  it("should not re-declare a flag in prerelease from unreleased", function () {
    Object.keys(flags.prerelease).filter(function (n) {
      return unreleased.indexOf(n) !== -1;
    }).length.should.equal(0);
  });
  it("should account for all *used* keys", function () {
    used.forEach(function(key){
      if (released  .indexOf(key) >= 0) return;
      if (unreleased.indexOf(key) >= 0) return;
      if (prerelease.indexOf(key) >= 0) return;

      throw new Error('Flag not accounted for');
    });
  });
});
