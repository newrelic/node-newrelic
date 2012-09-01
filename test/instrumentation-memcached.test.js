'use strict';

describe("agent instrumentation of memcached", function () {
  describe("for each operation", function () {
    it("should update the global aggregate statistics");
    it("should also update the global web aggregate statistics");
    it("should update the aggregate statistics for the operation type");
    it("should update the scoped aggregate statistics for the operation type");
  });

  it("should instrument setting data");
  it("should instrument adding data");
  it("should instrument appending data");
  it("should instrument prepending data");
  it("should instrument checking and setting data");
  it("should instrument incrementing data");
  it("should instrument decrementing data");
  it("should instrument getting data");
  it("should instrument deleting data");
});
