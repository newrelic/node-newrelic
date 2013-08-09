'use strict';

var path             = require('path')
  , Metric           = require(path.join(__dirname, 'metrics', 'metric'))
  , MetricNormalizer = require(path.join(__dirname, 'metrics', 'normalizer'))
  , RenameRules      = require(path.join(__dirname, 'metrics', 'rename-rules'))
  ;

function Metrics(apdexT, renamer, normalizer) {
  this.lastSendTime = Date.now();

  this.apdexT  = apdexT || 0;
  this.renamer = renamer || new RenameRules();
  this.normalizer = normalizer || new MetricNormalizer();

  // {name : Metric}
  this.unscoped = {};
  // {scope : {name : Metric}}
  this.scoped = {};
}

Metrics.prototype.resolveScope = function (scope) {
  var resolved;

  if (scope) {
    if (!this.scoped[scope]) this.scoped[scope] = {};

    resolved = this.scoped[scope];
  }
  else {
    resolved = this.unscoped;
  }

  return resolved;
};

Metrics.prototype.getMetric = function (name, scope) {
  return this.resolveScope(scope)[name];
};

Metrics.prototype.getOrCreateMetric = function (name, scope) {
  var resolved = this.resolveScope(scope);

  if (!resolved[name]) resolved[name] = new Metric(name, scope);

  return resolved[name];
};

Metrics.prototype.getOrCreateApdexMetric = function (name, scope) {
  var resolved = this.resolveScope(scope);

  if (!resolved[name]) resolved[name] = new Metric(name, scope, this.apdexT);

  return resolved[name];
};

Metrics.prototype.measureMilliseconds = function (name,
                                                  scope,
                                                  durationInMillis,
                                                  exclusiveInMillis) {
  var metric = this.getOrCreateMetric(name, scope);

  metric.stats.recordValueInMillis(durationInMillis, exclusiveInMillis);

  return metric;
};

Metrics.prototype.measureBytes = function (name, sizeInBytes) {
  var metric = this.getOrCreateMetric(name);

  metric.stats.recordValueInBytes(sizeInBytes);

  return metric;
};

/**
 * Return a serializable version of the unscoped metrics. Intended for use
 * by Metric.toJSON.
 */
Metrics.prototype.toUnscopedData = function () {
  var metricData = [];

  Object.keys(this.unscoped).forEach(function (name) {
    metricData.push(this.unscoped[name].toData(this.renamer));
  }, this);

  return metricData;
};

/**
 * Return a serializable version of the scoped metrics. Intended for use
 * by Metric.toJSON.
 */
Metrics.prototype.toScopedData = function () {
  var metricData = [];

  Object.keys(this.scoped).forEach(function (scope) {
    Object.keys(this.scoped[scope]).forEach(function (name) {
      metricData.push(this.scoped[scope][name].toData(this.renamer));
    }, this);
  }, this);

  return metricData;
};

Metrics.prototype.toJSON = function () {
  return this.toUnscopedData().concat(this.toScopedData());
};

/**
 * This only merges the statistics / metrics, not the renaming rules or apdex
 * tolerating value.
 *
 * Artisinally duck-typed for your pleasure.
 */
Metrics.prototype.merge = function (other) {
  Object.keys(other.unscoped).forEach(function (name) {
    if (this.unscoped[name]) {
      this.unscoped[name].stats.merge(other.unscoped[name].stats);
    }
    else {
      this.unscoped[name] = other.unscoped[name];
    }
  }, this);

  Object.keys(other.scoped).forEach(function (scope) {
    Object.keys(other.scoped[scope]).forEach(function (name) {
      if (other.scoped[scope].hasOwnProperty(name)) {
        var resolved = this.resolveScope(scope);
        if (resolved[name]) {
          resolved[name].stats.merge(other.scoped[scope][name].stats);
        }
        else {
          resolved[name] = other.scoped[scope][name];
        }
      }
    }, this);
  }, this);
};

module.exports = Metrics;
