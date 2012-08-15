'use strict';

var path             = require('path')
  , chai             = require('chai')
  , should           = chai.should()
  , expect           = chai.expect
  , logger           = require(path.join(__dirname, '..', 'lib', 'logger'))
  , metric           = require(path.join(__dirname, '..', 'lib', 'metric'))
  , Stats            = require(path.join(__dirname, '..', 'lib', 'stats'))
  , ApdexStats       = require(path.join(__dirname, '..', 'lib', 'stats', 'apdex'))
  , Metric           = require(path.join(__dirname, '..', 'lib', 'trace', 'metric'))
  , MetricNormalizer = require(path.join(__dirname, '..', 'lib', 'metric', 'normalizer'))
  , RenameRules      = require(path.join(__dirname, '..', 'lib', 'metric', 'rename-rules'))
  , Collection       = require(path.join(__dirname, '..', 'lib', 'stats', 'collection'))
  ;

function Engine(apdexT) {
  this.apdexT = apdexT;
  this.toJSON = function () { return 'apdexT: ' + apdexT; };
}

describe("web transaction metrics", function () {
  var normalizer
    , engine
    , statsCollection;

  before(function (done) {
    normalizer = new MetricNormalizer();

    return done();
  });

  describe("with Metric class", function () {
    it("should have a name", function () {
      var metric = new Metric('Agent/Test');
      expect(metric.name).equal('Agent/Test');
    });

    it("should throw if no name is passed", function () {
      expect(function () { var metric = new Metric(); }).throws("Metrics must be named");
      expect(function () { var metric = new Metric(null, 'TEST'); }).throws("Metrics must be named");
    });

    it("should have a scope (when one is included)", function () {
      var metric = new Metric('Agent/Test', 'TEST');
      expect(metric.scope).equal('TEST');
    });

    it("should have statistics available", function () {
      var metric = new Metric('Agent/Test');
      expect(metric.stats).an('object');
    });

    it("should have have ApdexStats when created with an apdex", function () {
      var metric = new Metric('Agent/ApdexTest', null, 0.87);
      expect(metric.stats.incrementFrustrating).a('function');
    });

    it("should have have regular / non-ApdexStats when created with no apdex", function () {
      var metric = new Metric('Agent/StatsTest');
      expect(metric.stats.incrementCallCount).a('function');
    });

    it("should produce a JSON representation with a name", function () {
      var metric = new Metric('Agent/Test');
      expect(metric.toJSON()).deep.equal({name : 'Agent/Test'});
    });

    it("should produce a JSON representation with a name & scope (when included)", function () {
      var metric = new Metric('Agent/Test', 'TEST');
      expect(metric.toJSON()).deep.equal({name : 'Agent/Test', scope : 'TEST'});
    });

    describe("when serializing", function () {
      var metric
        , renamer
        ;

      describe("with ordinary statistics", function () {
        beforeEach(function () {
          metric = new Metric('Agent/DataTest384');
          expect(metric.stats.incrementCallCount).a('function');
          renamer = new RenameRules([[{name : 'Agent/DataTest384'}, 'Agent/Serialization']]);
        });

        it("should get the bare stats right", function () {
          expect(JSON.stringify(metric.toData())).equal('[{"name":"Agent/DataTest384"},[0,0,0,0,0,0]]');
        });

        it("should correctly rename metrics given rules", function () {
          expect(JSON.stringify(metric.toData(renamer))).equal('[{"name":"Agent/Serialization"},[0,0,0,0,0,0]]');
        });

        it("should correctly serialize statistics", function () {
          metric.stats.recordValue(0.2, 0.1);
          expect(JSON.stringify(metric.toData())).equal('[{"name":"Agent/DataTest384"},[1,0.2,0.1,0.2,0.2,0.04000000000000001]]');
        });
      });

      describe("with apdex statistics", function () {
        beforeEach(function () {
          metric = new Metric('Agent/DataTest385', null, 0.8);
          expect(metric.stats.incrementFrustrating).a('function');
          renamer = new RenameRules([[{name : 'Agent/DataTest385'}, 'Agent/Serialization']]);
        });

        it("should get the bare stats right", function () {
          expect(JSON.stringify(metric.toData())).equal('[{"name":"Agent/DataTest385"},[0,0,0,0,0,0]]');
        });

        it("should correctly rename metrics given rules", function () {
          expect(JSON.stringify(metric.toData(renamer))).equal('[{"name":"Agent/Serialization"},[0,0,0,0,0,0]]');
        });

        it("should correctly serialize statistics", function () {
          metric.stats.recordValueInMillis(3220);
          expect(JSON.stringify(metric.toData())).equal('[{"name":"Agent/DataTest385"},[0,0,1,0,0,0]]');
        });
      });
    });
  });

  describe("when handling normal requests", function () {
    it("should correctly infer a satisfying end-user experience", function (done) {
      engine = new Engine(0.06);
      statsCollection = new Collection(engine);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 55, 55, 200);

      var result = {
        'WebTransaction/Uri/test' : [1, 0.055,     0, 0.055, 0.055, 0.003025],
        'Apdex/Uri/test' :          [1,     0,     0,     0,     0,        0],
        'Apdex' :                   [1,     0,     0,     0,     0,        0],
        'WebTransaction' :          [1, 0.055, 0.055, 0.055, 0.055, 0.003025],
        'HttpDispatcher' :          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });

    it("should correctly infer a tolerable end-user experience", function (done) {
      engine = new Engine(0.05);
      statsCollection = new Collection(engine);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 55, 100, 200);

      var result = {
        'WebTransaction/Uri/test' : [1, 0.055,     0, 0.055, 0.055, 0.003025],
        'Apdex/Uri/test' :          [0,     1,     0,     0,     0,        0],
        'Apdex' :                   [0,     1,     0,     0,     0,        0],
        'WebTransaction' :          [1, 0.055, 0.055, 0.055, 0.055, 0.003025],
        'HttpDispatcher' :          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });

    it("should correctly infer a frustrating end-user experience", function (done) {
      engine = new Engine(0.01);
      statsCollection = new Collection(engine);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 55, 55, 200);

      var result = {
        'WebTransaction/Uri/test' : [1, 0.055,     0, 0.055, 0.055, 0.003025],
        'Apdex/Uri/test' :          [0,     0,     1,     0,     0,        0],
        'Apdex' :                   [0,     0,     1,     0,     0,        0],
        'WebTransaction' :          [1, 0.055, 0.055, 0.055, 0.055, 0.003025],
        'HttpDispatcher' :          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });
  });

  describe("when dealing with exceptional requests", function () {
    it("should correctly handle missing resources", function (done) {
      engine = new Engine(0.01);
      statsCollection = new Collection(engine);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 55, 55, 404);

      var result = {
        'WebTransaction/StatusCode/404' : [1, 0.055,     0, 0.055, 0.055, 0.003025],
        'Apdex/StatusCode/404' :          [0,     0,     1,     0,     0,        0],
        'Apdex' :                         [0,     0,     1,     0,     0,        0],
        'WebTransaction' :                [1, 0.055, 0.055, 0.055, 0.055, 0.003025],
        'HttpDispatcher' :                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });

    it("should correctly handle bad requests", function (done) {
      engine = new Engine(0.01);
      statsCollection = new Collection(engine);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 55, 55, 400);

      var result = {
        'WebTransaction/StatusCode/400' : [1, 0.055,     0, 0.055, 0.055, 0.003025],
        'Apdex/StatusCode/400' :          [0,     0,     1,     0,     0,        0],
        'Apdex' :                         [0,     0,     1,     0,     0,        0],
        'WebTransaction' :                [1, 0.055, 0.055, 0.055, 0.055, 0.003025],
        'HttpDispatcher' :                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });

    it("should correctly handle over-long URIs", function (done) {
      engine = new Engine(0.01);
      statsCollection = new Collection(engine);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 55, 55, 414);

      var result = {
        'WebTransaction/StatusCode/414' : [1, 0.055,     0, 0.055, 0.055, 0.003025],
        'Apdex/StatusCode/414' :          [0,     0,     1,     0,     0,        0],
        'Apdex' :                         [0,     0,     1,     0,     0,        0],
        'WebTransaction' :                [1, 0.055, 0.055, 0.055, 0.055, 0.003025],
        'HttpDispatcher' :                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });

    it("should correctly handle internal server errors", function (done) {
      engine = new Engine(0.01);
      statsCollection = new Collection(engine);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 1, 1, 500);

      var result = {
        'WebTransaction/Uri/test' : [1, 0.001,     0, 0.001, 0.001, 0.000001],
        'Apdex/Uri/test' :          [0,     0,     1,     0,     0,        0],
        'Apdex' :                   [0,     0,     1,     0,     0,        0],
        'WebTransaction' :          [1, 0.001, 0.001, 0.001, 0.001, 0.000001],
        'HttpDispatcher' :          [1, 0.001, 0.001, 0.001, 0.001, 0.000001]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });
  });
});
