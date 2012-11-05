'use strict';

var path             = require('path')
  , chai             = require('chai')
  , expect           = chai.expect
  , EventEmitter     = require('events').EventEmitter
  , Metrics          = require(path.join(__dirname, '..', 'lib', 'metrics'))
  , RenameRules      = require(path.join(__dirname, '..', 'lib', 'metrics', 'rename-rules'))
  , MetricNormalizer = require(path.join(__dirname, '..', 'lib', 'metrics', 'normalizer'))
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
    var TEST_RENAMER = new RenameRules([[{name : 'Test/RenameMe333'}, 1337]]);
    var TEST_NORMALIZER = new MetricNormalizer();

    beforeEach(function () {
      metrics = new Metrics(TEST_APDEX, TEST_RENAMER, TEST_NORMALIZER);
    });

    it("should pass apdex through to ApdexStats", function () {
      var apdex = metrics.getOrCreateApdexMetric('Test/RenameMe333');
      expect(apdex.stats.apdexT).equal(TEST_APDEX);
    });

    it("should pass metric naming rules through for serialization", function () {
      metrics.measureDurationUnscoped('Test/RenameMe333', 400, 300);
      var summary = metrics.toJSON();
      expect(JSON.stringify(summary)).equal('[[1337,[1,0.4,0.3,0.4,0.4,0.16000000000000003]]]');
    });

    it("should expose configured normalizer", function () {
      expect(metrics.normalizer).equal(TEST_NORMALIZER);
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

  it("should not let exclusive duration exceed total duration");
});
