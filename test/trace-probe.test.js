'use strict';

describe("Probe", function () {
  it("should be bound to a Trace");
  it("should have 0 children at creation");
  it("should have a timer");
  describe("when finished", function () {
    it("should know its exclusive runtime");
  });
  it("should retain any associated SQL statements");
});
