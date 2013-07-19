'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("agent instrumentation of MongoDB", function () {
  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize
      ;

    before(function () {
      agent = helper.loadMockedAgent();
      initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'mongodb'));
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws();
    });

    it("when passed an empty module", function () {
      expect(function () { initialize(agent, {}); }).not.throws();
    });
  });
});
