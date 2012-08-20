'use strict';

var path             = require('path')
  , chai             = require('chai')
  , expect           = chai.expect
  , EventEmitter     = require('events').EventEmitter
  , Metrics          = require(path.join(__dirname, '..', 'lib', 'metric', 'metrics'))
  , RenameRules      = require(path.join(__dirname, '..', 'lib', 'metric', 'rename-rules'))
  , MetricNormalizer = require(path.join(__dirname, '..', 'lib', 'metric', 'normalizer'))
  ;

describe("Metrics", function () {
  var metrics;

  beforeEach(function () {
    metrics = new Metrics();
  });

  describe("when calling constructor with no parameters", function () {
    it("should default apdex to 0", function () {
      expect(metrics.apdexT).equal(0);
    });

    it("should return apdex summaries with a default apdexT of 0", function () {
      var metric = metrics.getOrCreateApdexMetric('Apdex/MetricsTest');
      expect(metric.stats.apdexT).equal(0);
    });

    it("should include blank set of metric renaming rules by default", function () {
      expect(metrics.renamer).deep.equal(new RenameRules());
    });
  });

  describe("when calling constructor with valid parameters", function () {
    var TEST_APDEX = 0.4;
    var TEST_RENAMER = new RenameRules([[{name : 'Test/RenameMe333'}, 'Test/Rollup']]);

    beforeEach(function () {
      metrics = new Metrics(TEST_RENAMER, TEST_APDEX);
    });

    it("should pass apdex through to ApdexStats", function () {
      var apdex = metrics.getOrCreateApdexMetric('Test/RenameMe333');
      expect(apdex.stats.apdexT).equal(TEST_APDEX);
    });

    it("should pass metric naming rules through for serialization", function () {
      metrics.measureDurationUnscoped('Test/RenameMe333', 400, 300);
      var summary = metrics.toJSON();
      expect(JSON.stringify(summary))
        .equal('[[{"name":"Test/Rollup"},[1,0.4,0.3,0.4,0.4,0.16000000000000003]]]');
    });
  });

  it("should create a new metric when nonexistent metric is requested", function () {
    var metric = metrics.getOrCreateMetric('Test/Nonexistent', 'TEST');
    expect(metric.toData).a('function');
  });

  it("should measure an unscoped metric", function () {
    metrics.measureDurationUnscoped('Test/UnscopedMetric', 400, 200);
    expect(JSON.stringify(metrics.toJSON()))
      .equal('[[{"name":"Test/UnscopedMetric"},[1,0.4,0.2,0.4,0.4,0.16000000000000003]]]');
  });

  it("should measure a scoped metric", function () {
    metrics.measureDurationScoped('Test/ScopedMetric', 'TEST', 400, 200);
    expect(JSON.stringify(metrics.toJSON()))
      .equal('[[{"name":"Test/ScopedMetric","scope":"TEST"},[1,0.4,0.2,0.4,0.4,0.16000000000000003]]]');
  });

  it("should resolve the correctly scoped set of metrics when scope passed", function () {
    metrics.measureDurationScoped('Apdex/ScopedMetricsTest', 'TEST');
    var scoped = metrics.resolveScope('TEST');

    expect(scoped['Apdex/ScopedMetricsTest']).an('object');
  });

  it("should implicitly create a blank set of metrics when nonexistent scope resolved", function () {
    var scoped = metrics.resolveScope('NOEXISTBRO');

    expect(scoped).an('object');
    expect(Object.keys(scoped).length).equal(0);
  });

  it("should return a preëxisting unscoped metric when it's requested", function () {
    metrics.measureDurationUnscoped('Test/UnscopedMetric', 400, 200);
    expect(metrics.getOrCreateMetric('Test/UnscopedMetric').stats.callCount).equal(1);
  });

  it("should return a preëxisting scoped metric when it's requested", function () {
    metrics.measureDurationScoped('Test/ScopedMetric', 'TEST', 400, 200);
    expect(metrics.getOrCreateMetric('Test/ScopedMetric', 'TEST').stats.callCount).equal(1);
  });

  it("should return the unscoped metrics when scope not set", function () {
    metrics.measureDurationUnscoped('Test/UnscopedMetric', 400, 200);
    expect(Object.keys(metrics.resolveScope()).length).equal(1);
    expect(Object.keys(metrics.scoped).length).equal(0);
  });

  it("should serialize unscoped metrics", function () {
    metrics.measureDurationUnscoped('Test/UnscopedMetric', 400, 200);
    metrics.measureDurationUnscoped('Test/RenameMe333', 400, 300);
    metrics.measureDurationScoped('Test/ScopedMetric', 'TEST', 400, 200);

    expect(JSON.stringify(metrics.toUnscopedData()))
      .equal('[[{"name":"Test/UnscopedMetric"},[1,0.4,0.2,0.4,0.4,0.16000000000000003]],' +
              '[{"name":"Test/RenameMe333"},[1,0.4,0.3,0.4,0.4,0.16000000000000003]]]');
  });

  it("should serialize scoped metrics", function () {
    metrics.measureDurationUnscoped('Test/UnscopedMetric', 400, 200);
    metrics.measureDurationScoped('Test/RenameMe333', 'TEST', 400, 300);
    metrics.measureDurationScoped('Test/ScopedMetric', 'ANOTHER', 400, 200);

    expect(JSON.stringify(metrics.toScopedData()))
      .equal('[[{"name":"Test/RenameMe333","scope":"TEST"},' +
               '[1,0.4,0.3,0.4,0.4,0.16000000000000003]],' +
              '[{"name":"Test/ScopedMetric","scope":"ANOTHER"},' +
               '[1,0.4,0.2,0.4,0.4,0.16000000000000003]]]');
  });

  it("should serialize all metrics", function () {
    metrics.measureDurationUnscoped('Test/UnscopedMetric', 400, 200);
    metrics.measureDurationUnscoped('Test/RenameMe333', 400, 300);
    metrics.measureDurationScoped('Test/ScopedMetric', 'TEST', 400, 200);

    expect(JSON.stringify(metrics.toJSON()))
      .equal('[[{"name":"Test/UnscopedMetric"},' +
               '[1,0.4,0.2,0.4,0.4,0.16000000000000003]],' +
              '[{"name":"Test/RenameMe333"},' +
               '[1,0.4,0.3,0.4,0.4,0.16000000000000003]],' +
              '[{"name":"Test/ScopedMetric","scope":"TEST"},' +
               '[1,0.4,0.2,0.4,0.4,0.16000000000000003]]]');
  });

  it("should merge multiple sets of metrics", function () {
    metrics.measureDurationUnscoped('Test/Metrics/Unscoped', 400);
    metrics.measureDurationUnscoped('Test/Unscoped', 300);
    metrics.measureDurationScoped('Test/Scoped', 'METRICS', 200);
    metrics.measureDurationScoped('Test/Scoped', 'MERGE', 100);

    var other = new Metrics();
    other.measureDurationUnscoped('Test/Other/Unscoped', 800);
    other.measureDurationUnscoped('Test/Unscoped', 700);
    other.measureDurationScoped('Test/Scoped', 'OTHER', 600);
    other.measureDurationScoped('Test/Scoped', 'MERGE', 500);

    metrics.merge(other);

    // singleton (unmerged) metrics
    expect(metrics.getOrCreateMetric('Test/Metrics/Unscoped').stats.callCount).equal(1);
    expect(metrics.getOrCreateMetric('Test/Other/Unscoped').stats.callCount).equal(1);
    expect(metrics.getOrCreateMetric('Test/Scoped', 'METRICS').stats.callCount).equal(1);
    expect(metrics.getOrCreateMetric('Test/Scoped', 'OTHER').stats.callCount).equal(1);

    // merged metrics
    expect(metrics.getOrCreateMetric('Test/Unscoped').stats.callCount).equal(2);
    expect(metrics.getOrCreateMetric('Test/Scoped', 'MERGE').stats.callCount).equal(2);
  });

  it("should dynamically update its apdex tolerating value", function (done) {
    var APDEX_VALUE = 0.725;

    expect(metrics.apdexT).equal(0);

    var checker = function (params) {
      expect(params.apdex_t).equal(APDEX_VALUE);
      expect(metrics.apdexT).equal(APDEX_VALUE);
      return done();
    };

    var emitter = new EventEmitter();
    emitter.addListener('change', metrics.updateApdexT.bind(metrics));
    emitter.addListener('change', checker);

    emitter.emit('change', {apdex_t : 0.725});
  });

  describe("when recording web transactions", function () {
    var normalizer;

    before(function () {
      normalizer = new MetricNormalizer();
    });

    describe("with normal requests", function () {
      it("should infer a satisfying end-user experience", function () {
        var metrics = new Metrics(null, 0.06);
        metrics.recordWebTransaction(normalizer, '/test', 55, 55, 200);

        var result = [
          [{name : 'WebTransaction'},          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'HttpDispatcher'},          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'WebTransaction/Uri/test'}, [1, 0.055,     0, 0.055, 0.055, 0.003025]],
          [{name : 'Apdex/Uri/test'},          [1,     0,     0,  0.06,  0.06,        0]],
          [{name : 'Apdex'},                   [1,     0,     0,  0.06,  0.06,        0]]
        ];
        expect(JSON.stringify(metrics)).equal(JSON.stringify(result));
      });

      it("should infer a tolerable end-user experience", function () {
        var metrics = new Metrics(null, 0.05);
        metrics.recordWebTransaction(normalizer, '/test', 55, 100, 200);

        var result = [
          [{name : 'WebTransaction'},          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'HttpDispatcher'},          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'WebTransaction/Uri/test'}, [1, 0.055,     0, 0.055, 0.055, 0.003025]],
          [{name : 'Apdex/Uri/test'},          [0,     1,     0,  0.05,  0.05,        0]],
          [{name : 'Apdex'},                   [0,     1,     0,  0.05,  0.05,        0]]
        ];
        expect(JSON.stringify(metrics)).equal(JSON.stringify(result));
      });

      it("should infer a frustrating end-user experience", function () {
        var metrics = new Metrics(null, 0.01);
        metrics.recordWebTransaction(normalizer, '/test', 55, 55, 200);

        var result = [
          [{name : 'WebTransaction'},          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'HttpDispatcher'},          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'WebTransaction/Uri/test'}, [1, 0.055,     0, 0.055, 0.055, 0.003025]],
          [{name : 'Apdex/Uri/test'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name : 'Apdex'},                   [0,     0,     1,  0.01,  0.01,        0]]
        ];
        expect(JSON.stringify(metrics)).equal(JSON.stringify(result));
      });
    });

    describe("with exceptional requests", function () {
      it("should handle missing resources", function () {
        var metrics = new Metrics(null, 0.01);
        metrics.recordWebTransaction(normalizer, '/test', 55, 55, 404);

        var result = [
          [{name : 'WebTransaction'},                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'HttpDispatcher'},                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'WebTransaction/StatusCode/404'}, [1, 0.055,     0, 0.055, 0.055, 0.003025]],
          [{name : 'Apdex/StatusCode/404'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name : 'Apdex'},                         [0,     0,     1,  0.01,  0.01,        0]]
        ];
        expect(JSON.stringify(metrics)).equal(JSON.stringify(result));
      });

      it("should handle bad requests", function () {
        var metrics = new Metrics(null, 0.01);
        metrics.recordWebTransaction(normalizer, '/test', 55, 55, 400);

        var result = [
          [{name : 'WebTransaction'},                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'HttpDispatcher'},                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'WebTransaction/StatusCode/400'}, [1, 0.055,     0, 0.055, 0.055, 0.003025]],
          [{name : 'Apdex/StatusCode/400'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name : 'Apdex'},                         [0,     0,     1,  0.01,  0.01,        0]]
        ];
        expect(JSON.stringify(metrics)).equal(JSON.stringify(result));
      });

      it("should handle over-long URIs", function () {
        var metrics = new Metrics(null, 0.01);
        metrics.recordWebTransaction(normalizer, '/test', 55, 55, 414);

        var result = [
          [{name : 'WebTransaction'},                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'HttpDispatcher'},                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'WebTransaction/StatusCode/414'}, [1, 0.055,     0, 0.055, 0.055, 0.003025]],
          [{name : 'Apdex/StatusCode/414'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name : 'Apdex'},                         [0,     0,     1,  0.01,  0.01,        0]]
        ];
        expect(JSON.stringify(metrics)).equal(JSON.stringify(result));
      });

      it("should handle internal server errors", function () {
        var metrics = new Metrics(null, 0.01);
        metrics.recordWebTransaction(normalizer, '/test', 1, 1, 500);

        var result = [
          [{name : 'WebTransaction'},          [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
          [{name : 'HttpDispatcher'},          [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
          [{name : 'WebTransaction/Uri/test'}, [1, 0.001,     0, 0.001, 0.001, 0.000001]],
          [{name : 'Apdex/Uri/test'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name : 'Apdex'},                   [0,     0,     1,  0.01,  0.01,        0]]
        ];
        expect(JSON.stringify(metrics)).equal(JSON.stringify(result));
      });
    });
  });
});
