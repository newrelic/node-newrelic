'use strict';

var path   = require('path')
  , util   = require('util')
  , chai   = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , sinon  = require('sinon')
  , bson   = require('bson')
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

function dox() {
  return {documents : [{}]};
}

describe("agent instrumentation of MongoDB", function () {
  var agent
    , mongodb
    , db
    , pkfactory
    ;

  beforeEach(function () {
    agent = helper.instrumentMockedAgent();

    // load the driver after loading is patched
    mongodb = require('mongodb');

    var serverConfig = new mongodb.Server('localhost', 27017);
    db = new mongodb.Db('notreal', serverConfig, {safe : true});
    pkfactory = mongodb.ObjectID;
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize
      ;

    before(function () {
      agent = helper.loadMockedAgent();
      initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'mongodb'));
    });

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws();
    });

    it("when passed an empty module", function () {
      expect(function () { initialize(agent, {}); }).not.throws();
    });
  });

  describe("for each operation", function () {
    beforeEach(function (done) {
      sinon.stub(db, '_executeInsertCommand', function (inserter, options, callback) {
        callback(null, dox());
      });

      agent.once('transactionFinished', function () {
        return done();
      });

      helper.runInTransaction(agent, function () {
        var collection = new mongodb.Collection(db, 'fake', pkfactory);
        collection.insert({id : 1, hamchunx : 'verbloks'},
                          {safe : true},
                          function (error, result) {
          if (error) return done(error);

          var transaction = agent.getTransaction();
          should.exist(transaction);

          transaction.end();
        });
      });
    });

    it("should update the global database aggregate statistics", function () {
      var stats = agent.metrics.getMetric('Database/all').stats;
      expect(stats.callCount).equal(1);
    });

    it("should update the aggregate statistics for the operation type", function () {
      var stats = agent.metrics.getMetric('Database/insert').stats;
      expect(stats.callCount).equal(1);
    });

    it("should update the aggregate statistics for the specific query", function () {
      var stats = agent.metrics.getMetric('Database/fake/insert').stats;
      expect(stats.callCount).equal(1);
    });

    it("should update the scoped aggregate statistics for the operation type", function () {
      var stats = agent.metrics.getMetric('Database/fake/insert', 'MongoDB/fake/insert').stats;
      expect(stats.callCount).equal(1);
    });
  });

  it("should instrument inserting documents", function (done) {
    sinon.stub(db, '_executeInsertCommand', function (inserter, options, callback) {
      callback(null, dox());
    });

    agent.once('transactionFinished', function () {
      var stats = agent.metrics.getMetric('Database/fake/insert', 'MongoDB/fake/insert').stats;
      expect(stats.callCount).equal(1);

      return done();
    });

    helper.runInTransaction(agent, function () {
      var collection = new mongodb.Collection(db, 'fake', pkfactory);
      collection.insert({id : 1, hamchunx : 'verbloks'},
                        {safe : true},
                        function (error, result) {
        if (error) return done(error);

        var transaction = agent.getTransaction();
        should.exist(transaction);

        transaction.end();
      });
    });
  });

  it("should instrument finding documents", function (done) {
    var returned = false;
    sinon.stub(mongodb.Cursor.prototype, 'nextObject', function (callback) {
      if (!returned) {
        returned = true;
        callback(null, {id : 1, hamchunx : 'verbloks'});
      }
      else {
        callback(null, null);
      }
    });

    agent.once('transactionFinished', function () {
      var stats = agent.metrics.getMetric('Database/fake/find', 'MongoDB/fake/find').stats;
      expect(stats.callCount).equal(1);

      mongodb.Cursor.prototype.nextObject.restore();
      return done();
    });

    helper.runInTransaction(agent, function () {
      var collection = new mongodb.Collection(db, 'fake', pkfactory);
      collection.findOne({id : 1},
                         {safe : true},
                         function (error, result) {
        if (error) return done(error);

        should.exist(result);

        var transaction = agent.getTransaction();
        should.exist(transaction);

        transaction.end();
      });
    });
  });

  it("should instrument updating documents", function (done) {
    sinon.stub(db, '_executeUpdateCommand', function (updater, options, callback) {
      callback(null, dox());
    });

    agent.once('transactionFinished', function () {
      var stats = agent.metrics.getMetric('Database/fake/update', 'MongoDB/fake/update').stats;
      expect(stats.callCount).equal(1);

      return done();
    });

    helper.runInTransaction(agent, function () {
      var collection = new mongodb.Collection(db, 'fake', pkfactory);
      collection.update({a:1},
                        {$set:{b:2}},
                        function (error, results) {
        if (error) return done(error);

        var transaction = agent.getTransaction();
        should.exist(transaction);

        transaction.end();
      });
    });
  });

  it("should instrument removing documents", function (done) {
    sinon.stub(db, '_executeRemoveCommand', function (updater, options, callback) {
      callback(null, dox());
    });

    agent.once('transactionFinished', function () {
      var stats = agent.metrics.getMetric('Database/fake/remove', 'MongoDB/fake/remove').stats;
      expect(stats.callCount).equal(1);

      return done();
    });

    helper.runInTransaction(agent, function () {
      var collection = new mongodb.Collection(db, 'fake', pkfactory);
      collection.remove({a:1},
                        {safe : true},
                        function (error, result) {
        if (error) return done(error);

        var transaction = agent.getTransaction();
        should.exist(transaction);

        transaction.end();
      });
    });
  });

  it("should instrument saving documents", function (done) {
    sinon.stub(db, '_executeInsertCommand', function (inserter, options, callback) {
      callback(null, dox());
    });

    agent.once('transactionFinished', function () {
      var stats = agent.metrics.getMetric('Database/fake/insert', 'MongoDB/fake/insert').stats;
      expect(stats.callCount).equal(1);

      return done();
    });

    helper.runInTransaction(agent, function () {
      var collection = new mongodb.Collection(db, 'fake', pkfactory);
      collection.save({hamchunx : 'verblox'},
                      {safe : true},
                      function (error, result) {
        if (error) return done(error);

        var transaction = agent.getTransaction();
        should.exist(transaction);

        transaction.end();
      });
    });
  });
});
