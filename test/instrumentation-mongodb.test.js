'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("agent instrumentation of MongoDB", function () {
  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize
      ;

    before(function () {
      agent = helper.loadMockedAgent();
      initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'mongodb'));
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

  describe("when capturing terms is disabled", function () {
    var agent
      , segment
      , terms
      ;

    before(function (done) {
      function StubCollection () {}

      StubCollection.prototype.findAndModify = function (terms, options, callback) {
        this.terms = terms;
        this.options = options;
        process.nextTick(function () { callback(null, 1); });
      };

      var mockodb    = {Collection : StubCollection}
        , collection = new mockodb.Collection('test')
        , initialize = require(path.join(__dirname, '..', 'lib',
                                         'instrumentation', 'mongodb'))
        ;

      agent = helper.loadMockedAgent();
      agent.on('transactionFinished', function (transaction) {
        // need to generate the trace so exclusive times are added to segment parameters
        transaction.getTrace().generateJSON(function () {
          terms = collection.terms;
          segment = transaction.trace.root.children[0];

          done();
        });
      });

      initialize(agent, mockodb);

      helper.runInTransaction(agent, function (trans) {
        collection.findAndModify({val : 'hi'}, {w : 333}, function () {
          process.nextTick(function () { trans.end(); });
        });
      });
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("shouldn't modify query terms", function () {
      should.not.exist(terms.nr_exclusive_duration_millis);
    });

    it("shouldn't copy query terms onto segment parameters", function () {
      should.not.exist(segment.parameters.val);
    });
  });

  describe("when capturing terms is enabled", function () {
    var agent
      , segment
      , terms
      ;

    before(function (done) {
      function StubCollection () {}

      StubCollection.prototype.findAndModify = function (terms, options, callback) {
        this.terms = terms;
        this.options = options;
        process.nextTick(function () { callback(null, 1); });
      };

      var mockodb    = {Collection : StubCollection}
        , collection = new mockodb.Collection('test')
        , initialize = require(path.join(__dirname, '..', 'lib',
                                         'instrumentation', 'mongodb'))
        ;

      agent = helper.loadMockedAgent();
      agent.config.capture_params = true;
      agent.config.ignored_params = ['other'];
      agent.on('transactionFinished', function (transaction) {
        // need to generate the trace so exclusive times are added to segment parameters
        transaction.getTrace().generateJSON(function () {
          terms = collection.terms;
          segment = transaction.trace.root.children[0];

          done();
        });
      });

      initialize(agent, mockodb);

      helper.runInTransaction(agent, function (trans) {
        collection.findAndModify({val : 'hi', other : 'bye'}, {w : 333}, function () {
          process.nextTick(function () { trans.end(); });
        });
      });
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("shouldn't modify query terms", function () {
      should.not.exist(terms.nr_exclusive_duration_millis);
    });

    it("should append query terms onto segment parameters", function () {
      expect(segment.parameters.val).equal('hi');
    });

    it("should respect ignored parameter list", function () {
      should.not.exist(segment.parameters.other);
    });
  });

  describe("with child MongoDB operations", function () {
    var agent
      , transaction
      , collection
      , error
      , removed
      ;

    before(function (done) {
      function StubCollection (name) {
        this.collectionName = name;
      }

      StubCollection.prototype.findAndRemove = function (terms, options, callback) {
        this.findAndModify(terms, options, callback);
      };

      StubCollection.prototype.findAndModify = function (terms, options, callback) {
        this.terms = terms;
        this.options = options;
        process.nextTick(function () {
          callback(null, 1);
        });
      };

      var mockodb = {Collection : StubCollection};

      agent = helper.loadMockedAgent();
      agent.on('transactionFinished', done.bind(null, null));

      var initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'mongodb'));
      initialize(agent, mockodb);

      collection = new mockodb.Collection('test');

      helper.runInTransaction(agent, function (trans) {
        transaction = trans;
        collection.findAndRemove({val : 'hi'}, {w : 333}, function (err, rem) {
          error = err;
          removed = rem;

          transaction.end();
        });
      });
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("should have left the query terms alone", function () {
      expect(collection.terms).eql({val : 'hi'});
    });

    it("should have left the query options alone", function () {
      expect(collection.options).eql({w : 333});
    });

    it("shouldn't have messed with the error parameter", function () {
      should.not.exist(error);
    });

    it("shouldn't have messed with the result parameter", function () {
      expect(removed).equal(1);
    });

    it("should have only one segment (the parent) under the trace root", function () {
      var root = transaction.getTrace().root;
      expect(root.children.length).equal(1);
    });

    it("should have recorded the findAndRemove operation", function () {
      var root   = transaction.getTrace().root
        , parent = root.children[0]
        ;

      expect(parent.name).equal('Datastore/statement/MongoDB/test/findAndRemove');
    });

    it("should have no child segments under the parent", function () {
      var root   = transaction.getTrace().root
        , parent = root.children[0]
        ;

      expect(parent.children.length).equal(0);
    });

    it("should have gathered metrics", function () {
      var metrics = transaction.metrics;
      should.exist(metrics);
    });

    it("should have recorded only one database call", function () {
      var metrics = transaction.metrics;
      expect(metrics.getMetric('Datastore/all').callCount).equal(1);
    });

    it("should have that call be the findAndRemove", function () {
      var metrics = transaction.metrics
        , metric  = metrics.getMetric('Datastore/statement/MongoDB/test/findAndRemove')
        ;

      should.exist(metric);
      expect(metric.callCount).equal(1);
    });
  });
});
