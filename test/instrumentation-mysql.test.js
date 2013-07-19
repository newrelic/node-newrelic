'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("agent instrumentation of MySQL", function () {
  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize
      ;

    before(function () {
      agent = helper.loadMockedAgent();
      initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'mysql'));
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

  describe("for each operation", function () {
    it("should update the global database aggregate statistics");
    it("should also update the global web aggregate statistics");
    it("should update the aggregate statistics for the operation type");
    it("should update the aggregate statistics for the specific query");
    it("should update the scoped aggregate statistics for the operation type");
  });

  describe("should instrument", function () {
    it("INSERT");
    it("SELECT");
    it("UPDATE");
    it("DELETE");
    it("EXPLAIN");
    it("ALTER TABLE");
    it("DROP TABLE");
  });
});
