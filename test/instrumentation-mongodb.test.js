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
    ;

  beforeEach(function () {
    agent = helper.loadMockedAgent();
    shimmer.bootstrapInstrumentation(agent);

    // load mongodb-native
    mongodb = require('mongodb');
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  describe("for each operation", function () {
    it("should update the global database aggregate statistics", function (done) {
      // mock setup
      var pkfactory    = require('bson').BSONPure.ObjectID
        , serverConfig = new mongodb.Server('localhost', 27017)
        , db           = new mongodb.Db('notreal', serverConfig, {safe : true})
        , collection   = new mongodb.Collection(db, 'fake', pkfactory)
        ;

      serverConfig._serverState = 'connected';
      sinon.stub(serverConfig, 'checkoutWriter', function () {
        return {write : function () {}};
      });

      helper.runInTransaction(agent, function () {
        collection.insert({id : 1, hamchunx : 'verbloks'}, function (error, result) {
          if (error) return done(error);

          var transaction = agent.getTransaction();
          should.exist(transaction);

          mongodb.Connection.prototype.write.restore();
          return done();
        });
        db._callBackStore.emit('1', null, 'ham');
      });
    });

    it("should also update the global web aggregate statistics");
    it("should update the aggregate statistics for the operation type");
    it("should update the aggregate statistics for the specific query");
    it("should update the scoped aggregate statistics for the operation type");
  });

  it("should instrument inserting documents");
  it("should instrument finding documents");
  it("should instrument updating documents");
  it("should instrument removing documents");
  it("should instrument saving documents");
});
