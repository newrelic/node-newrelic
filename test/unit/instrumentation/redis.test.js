'use strict'

var path = require('path')
var chai = require('chai')
var expect = chai.expect
var should = chai.should()
var sinon = require('sinon')
var helper = require('../../lib/agent_helper')


function FakeConnection () {
  this.writable = true
}

FakeConnection.prototype.on = function on(event, callback) {
  if (event === 'connect') return callback()
  if (event === 'data') {
    this.on_data = callback
    return callback
  }
}

FakeConnection.prototype.setNoDelay = function setNoDelay(bagel) {
  if (bagel !== false) this.bagel = true
}

FakeConnection.prototype.setTimeout = function setTimeout(timeout) {
  this.timeout = timeout
}

FakeConnection.prototype.setKeepAlive = function setKeepAlive(keepAlive){
  this.keepAlive = keepAlive
}

FakeConnection.prototype.write = function write() {}

describe('agent instrumentation of Redis', function () {
  describe('shouldn\'t cause bootstrapping to fail', function () {
    var agent
    var initialize


    before(function () {
      agent = helper.loadMockedAgent()
      initialize = require('../../../lib/instrumentation/redis')
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('when passed no module', function () {
      expect(function () { initialize(agent); }).not.throws()
    })

    it('when passed a module with no RedisClient present.', function () {
      expect(function () { initialize(agent, {}); }).not.throws()
    })
  })

  // Redis has a lot of commands, and this is not all of them.
  describe('should instrument', function () {
    var agent
    var client
    var connection
    var mockConnection


    beforeEach(function () {
      agent = helper.instrumentMockedAgent()
      var redis = require('redis')

      connection = new FakeConnection()
      mockConnection = sinon.mock(connection)

      client = new redis.RedisClient(connection, {no_ready_check : true})
      client.host = 'fakehost.example.local'
      client.port = 8765
    })

    afterEach(function () {
      mockConnection.verify()
      helper.unloadAgent(agent)
    })

    it('PING', function (done) {
      mockConnection.expects('write').withExactArgs('*1\r\n$4\r\nping\r\n').once()

      agent.once('transactionFinished', function (transaction) {
        var stats = transaction.metrics.getMetric('Datastore/operation/Redis/ping')
        expect(stats.callCount).equal(1)

        return done()
      })

      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction()
        should.exist(transaction)

        client.PING(function cb_PING(error, results) {
          if (error) return done(error)

          should.exist(agent.getTransaction())
          expect(results, 'PING should still work').equal('PONG')
        })

        should.exist(connection.on_data)
        connection.on_data(new Buffer('+PONG\r\n'))

        transaction.end()
      })
    })

    it('PING without callback', function (done) {
      mockConnection.expects('write').withExactArgs('*1\r\n$4\r\nping\r\n').once()

      agent.once('transactionFinished', function (transaction) {
        var stats = transaction.metrics.getMetric('Datastore/operation/Redis/ping')
        expect(stats.callCount).equal(1)

        return done()
      })

      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction()
        should.exist(transaction)

        client.PING()

        should.exist(connection.on_data)
        connection.on_data(new Buffer('+PONG\r\n'))

        transaction.end()
      })
    })

    it('PING with callback in array', function (done) {
      mockConnection
        .expects('write')
        .withExactArgs('*3\r\n$4\r\nping\r\n$1\r\n1\r\n$1\r\n2\r\n')
        .once()

      agent.once('transactionFinished', function (transaction) {
        var stats = transaction.metrics.getMetric('Datastore/operation/Redis/ping')
        expect(stats.callCount).equal(1)

        return done()
      })

      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction()
        should.exist(transaction)

        client.PING(1, 2, function (error, results) {
          if (error) return done(error)

          should.exist(agent.getTransaction())
          expect(results, 'PING should still work').equal('PONG')
        })

        should.exist(connection.on_data)
        connection.on_data(new Buffer('+PONG\r\n'))

        transaction.end()
      })
    })

    it('PING with no callback in array', function (done) {
      mockConnection
        .expects('write')
        .withExactArgs('*3\r\n$4\r\nping\r\n$1\r\n1\r\n$1\r\n2\r\n')
        .once()

      agent.once('transactionFinished', function (transaction) {
        var stats = transaction.metrics.getMetric('Datastore/operation/Redis/ping')
        expect(stats.callCount).equal(1)

        return done()
      })

      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction()
        should.exist(transaction)

        client.PING(1, 2)

        should.exist(connection.on_data)
        connection.on_data(new Buffer('+PONG\r\n'))

        transaction.end()
      })
    })
  })
})
