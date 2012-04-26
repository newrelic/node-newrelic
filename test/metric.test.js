var logger  = require('../lib/logger')
  , metric  = require('../lib/metric')
  , stats   = require('../lib/stats')
  ;

function Agent(apdexT) {
  this.getApdexT = function () {
    return apdexT;
  };
}

describe('web transaction metrics', function () {
  var normalizer
    , agent
    , statsCollection;

  before(function (done) {
    normalizer = new metric.MetricNormalizer();

    return done();
  });

  describe('when handling normal requests', function () {
    it('should correctly infer a satisfying end-user experience', function (done) {
      agent = new Agent(0.06);
      statsCollection = new stats.StatsCollection(agent);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 55, 55, 200);

      var result = {
        "WebTransaction/Uri/test" : [1, 0.055,     0, 0.055, 0.055, 0.003025],
        "Apdex/Uri/test" :          [1,     0,     0,     0,     0,        0],
        "Apdex" :                   [1,     0,     0,     0,     0,        0],
        "WebTransaction" :          [1, 0.055, 0.055, 0.055, 0.055, 0.003025],
        "HttpDispatcher" :          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });

    it('should correctly infer a tolerable end-user experience', function (done) {
      agent = new Agent(0.05);
      statsCollection = new stats.StatsCollection(agent);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 55, 100, 200);

      var result = {
        "WebTransaction/Uri/test" : [1, 0.055,     0, 0.055, 0.055, 0.003025],
        "Apdex/Uri/test" :          [0,     1,     0,     0,     0,        0],
        "Apdex" :                   [0,     1,     0,     0,     0,        0],
        "WebTransaction" :          [1, 0.055, 0.055, 0.055, 0.055, 0.003025],
        "HttpDispatcher" :          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });

    it('should correctly infer a frustrating end-user experience', function (done) {
      agent = new Agent(0.01);
      statsCollection = new stats.StatsCollection(agent);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 55, 55, 200);

      var result = {
        "WebTransaction/Uri/test" : [1, 0.055,     0, 0.055, 0.055, 0.003025],
        "Apdex/Uri/test" :          [0,     0,     1,     0,     0,        0],
        "Apdex" :                   [0,     0,     1,     0,     0,        0],
        "WebTransaction" :          [1, 0.055, 0.055, 0.055, 0.055, 0.003025],
        "HttpDispatcher" :          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });
  });

  describe('when dealing with exceptional requests', function () {
    it('should correctly handle missing resources', function (done) {
      agent = new Agent(0.01);
      statsCollection = new stats.StatsCollection(agent);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 55, 55, 404);

      var result = {
        "WebTransaction/StatusCode/404" : [1, 0.055,     0, 0.055, 0.055, 0.003025],
        "Apdex/StatusCode/404" :          [0,     0,     1,     0,     0,        0],
        "Apdex" :                         [0,     0,     1,     0,     0,        0],
        "WebTransaction" :                [1, 0.055, 0.055, 0.055, 0.055, 0.003025],
        "HttpDispatcher" :                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });

    it('should correctly handle bad requests', function (done) {
      agent = new Agent(0.01);
      statsCollection = new stats.StatsCollection(agent);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 55, 55, 400);

      var result = {
        "WebTransaction/StatusCode/400" : [1, 0.055,     0, 0.055, 0.055, 0.003025],
        "Apdex/StatusCode/400" :          [0,     0,     1,     0,     0,        0],
        "Apdex" :                         [0,     0,     1,     0,     0,        0],
        "WebTransaction" :                [1, 0.055, 0.055, 0.055, 0.055, 0.003025],
        "HttpDispatcher" :                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });

    it('should correctly handle over-long URIs', function (done) {
      agent = new Agent(0.01);
      statsCollection = new stats.StatsCollection(agent);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 55, 55, 414);

      var result = {
        "WebTransaction/StatusCode/414" : [1, 0.055,     0, 0.055, 0.055, 0.003025],
        "Apdex/StatusCode/414" :          [0,     0,     1,     0,     0,        0],
        "Apdex" :                         [0,     0,     1,     0,     0,        0],
        "WebTransaction" :                [1, 0.055, 0.055, 0.055, 0.055, 0.003025],
        "HttpDispatcher" :                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });

    it('should correctly handle internal server errors', function (done) {
      agent = new Agent(0.01);
      statsCollection = new stats.StatsCollection(agent);
      metric.recordWebTransactionMetrics(normalizer, statsCollection, '/test', 1, 1, 500);

      var result = {
        "WebTransaction/Uri/test" : [1, 0.001,     0, 0.001, 0.001, 0.000001],
        "Apdex/Uri/test" :          [0,     0,     1,     0,     0,        0],
        "Apdex" :                   [0,     0,     1,     0,     0,        0],
        "WebTransaction" :          [1, 0.001, 0.001, 0.001, 0.001, 0.000001],
        "HttpDispatcher" :          [1, 0.001, 0.001, 0.001, 0.001, 0.000001]
      };
      JSON.stringify(statsCollection).should.equal(JSON.stringify(result));

      return done();
    });
  });
});
