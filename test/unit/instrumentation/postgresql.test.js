'use strict';

describe("agent instrumentation of PostgreSQL", function () {
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
