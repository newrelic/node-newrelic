'use strict';

describe("agent instrumentation of Redis", function () {
  describe("for each operation", function () {
    it("should update the global aggregate statistics");
    it("should also update the global web aggregate statistics");
    it("should update the aggregate statistics for the operation type");
    it("should update the scoped aggregate statistics for the operation type");
  });

  // Redis has a lot of commands, and this is not all of them.
  describe("should instrument", function () {
    it("PING");
    it("SET");
    it("HSET");
    it("MSET");
    it("SETNX");
    it("HSETNX");
    it("MSETNX");
    it("HMSET");
    it("GET");
    it("HGET");
    it("HGETALL");
    it("MGET");
    it("HMGET");
    it("DEL");
    it("HDEL");
    it("EXISTS");
    it("HEXISTS");
    it("EXPIRE");
    it("EXPIREAT");
    it("PUBLISH");
    it("SUBSCRIBE");
    it("UNSUBSCRIBE");
    it("SUNION");
    it("SUNIONSTORE");
    it("AUTH");
    it("PERSIST");
    it("BITCOUNT");
  });
});
