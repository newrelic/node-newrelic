'use strict';

var path    = require('path')
  , chai    = require('chai')
  , expect  = chai.expect
  , should  = chai.should()
  , sinon   = require('sinon')
  , shimmer = require(path.join(__dirname, '..', 'lib', 'shimmer'))
  , helper  = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("agent instrumentation of MongoDB", function () {
  var agent
    , mongodb
    , db
    , pkfactory
    ;

  beforeEach(function () {
    agent = helper.loadMockedAgent();
    shimmer.bootstrapInstrumentation(agent);

    // load the driver after loading is patched
    mongodb = require('mongodb');

    var serverConfig = new mongodb.Server('localhost', 27017);
    db = new mongodb.Db('notreal', serverConfig, {safe : true});
    pkfactory = mongodb.ObjectID;
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  describe("for each operation", function () {
    beforeEach(function (done) {
      sinon.stub(db, '_executeInsertCommand', function (inserter, options, callback) {
        callback(null, {documents : [{}]});
      });

      helper.runInTransaction(agent, function () {
        var collection = new mongodb.Collection(db, 'fake', pkfactory);
        collection.insert({id : 1, hamchunx : 'verbloks'},
                          {safe : true},
                          function (error, result) {
          if (error) return done(error);

          var transaction = agent.getTransaction();
          should.exist(transaction);

          agent.once('transactionFinished', function () {
            return done();
          });
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
      var stats = agent.metrics.getMetric('Database/insert').stats;
      expect(stats.callCount).equal(1);
    });

    it("should update the scoped aggregate statistics for the operation type", function () {
      var stats = agent.metrics.getMetric('Database/fake/insert', 'MongoDB/fake/insert').stats;
      expect(stats.callCount).equal(1);
    });
  });

  it("should instrument inserting documents");
  it("should instrument finding documents");
  it("should instrument updating documents");
  it("should instrument removing documents");
  it("should instrument saving documents");
});
