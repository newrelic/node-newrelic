'use strict';

var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , should       = chai.should()
  , sinon        = require('sinon')
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

function FakeConnection () {
  this.writable = true;
}

FakeConnection.prototype.on = function (event, callback) {
  if (event === 'connect') return callback();
  if (event === 'data') {
    this.on_data = callback;
    return callback;
  }
};

FakeConnection.prototype.setNoDelay = function (bagel) {
  if (bagel !== false) this.bagel = true;
};

FakeConnection.prototype.setTimeout = function (timeout) {
  this.timeout = timeout;
};

FakeConnection.prototype.write = function () {};

describe("agent instrumentation of Redis", function () {
  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize
      ;

    before(function () {
      agent = helper.loadMockedAgent();
      initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'redis'));
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws();
    });

    it("when passed a module with no RedisClient present.", function () {
      expect(function () { initialize(agent, {}); }).not.throws();
    });
  });

  describe("for each operation", function () {
    it("should update the global aggregate statistics");
    it("should also update the global web aggregate statistics");
    it("should update the aggregate statistics for the operation type");
    it("should update the scoped aggregate statistics for the operation type");
  });

  // Redis has a lot of commands, and this is not all of them.
  describe("should instrument", function () {
    var agent
      , client
      , connection
      , mockConnection
      ;

    beforeEach(function () {
      agent = helper.instrumentMockedAgent();
      var redis = require('redis');

      connection = new FakeConnection();
      mockConnection = sinon.mock(connection);

      client = new redis.RedisClient(connection, {no_ready_check : true});
      client.host = 'fakehost.example.local';
      client.port = 8765;
    });

    afterEach(function () {
      mockConnection.verify();
      helper.unloadAgent(agent);
    });

    it("PING", function (done) {
      mockConnection.expects('write').withExactArgs('*1\r\n$4\r\nping\r\n').once();

      agent.once('transactionFinished', function (transaction) {
        var stats = transaction.metrics.getMetric('Datastore/operation/Redis/ping');
        expect(stats.callCount).equal(1);

        return done();
      });

      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction();
        should.exist(transaction);

        client.PING(function (error, results) {
          if (error) return done(error);

          should.exist(agent.getTransaction());
          expect(results, "PING should still work").equal('PONG');
        });

        should.exist(connection.on_data);
        connection.on_data(new Buffer('+PONG\r\n'));

        transaction.end();
      });
    });

    it("PING without callback", function (done) {
      mockConnection.expects('write').withExactArgs('*1\r\n$4\r\nping\r\n').once();

      agent.once('transactionFinished', function (transaction) {
        var stats = transaction.metrics.getMetric('Datastore/operation/Redis/ping');
        expect(stats.callCount).equal(1);

        return done();
      });

      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction();
        should.exist(transaction);

        client.PING();

        should.exist(connection.on_data);
        connection.on_data(new Buffer('+PONG\r\n'));

        transaction.end();
      });
    });

    it("PING with callback in array", function (done) {
      mockConnection
        .expects('write')
        .withExactArgs('*3\r\n$4\r\nping\r\n$1\r\n1\r\n$1\r\n2\r\n')
        .once();

      agent.once('transactionFinished', function (transaction) {
        var stats = transaction.metrics.getMetric('Datastore/operation/Redis/ping');
        expect(stats.callCount).equal(1);

        return done();
      });

      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction();
        should.exist(transaction);

        client.PING(1, 2, function (error, results) {
          if (error) return done(error);

          should.exist(agent.getTransaction());
          expect(results, "PING should still work").equal('PONG');
        });

        should.exist(connection.on_data);
        connection.on_data(new Buffer('+PONG\r\n'));

        transaction.end();
      });
    });

    it("PING with no callback in array", function (done) {
      mockConnection
        .expects('write')
        .withExactArgs('*3\r\n$4\r\nping\r\n$1\r\n1\r\n$1\r\n2\r\n')
        .once();

      agent.once('transactionFinished', function (transaction) {
        var stats = transaction.metrics.getMetric('Datastore/operation/Redis/ping');
        expect(stats.callCount).equal(1);

        return done();
      });

      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction();
        should.exist(transaction);

        client.PING(1, 2);

        should.exist(connection.on_data);
        connection.on_data(new Buffer('+PONG\r\n'));

        transaction.end();
      });
    });

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
