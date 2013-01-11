'use strict';

var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("built-in fs module instrumentation", function () {
  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize
      ;

    before(function () {
      agent = helper.loadMockedAgent();
      initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'core', 'fs'));
    });

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws();
    });

    it("when passed a module with no RedisClient present.", function () {
      expect(function () { initialize(agent, {}); }).not.throws();
    });
  });

  it("should pick up scope when called in a scoped transaction");
});
