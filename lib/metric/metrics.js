'use strict';

var path = require('path')
  , Metric = require(path.join(__dirname, '..', 'trace', 'metric'))
  ;

var Metrics = function (metricIds, apdexT) {
  this.metricIds = metricIds || {};
  this.apdexT    = apdexT || 0;

  // {name : Metric}
  this.unscoped = {};
  // {scope : {name : Metric}}
  this.scoped = {};
};

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

Metrics.prototype.measureDurationScoped = function (name, scope, durationInMillis, exclusiveInMillis) {
  var metric = this.getOrCreateMetric(name, scope);

  metric.stats.recordValueInMillis(durationInMillis, exclusiveInMillis);
};

Metrics.prototype.measureDurationUnscoped = function (name, durationInMillis, exclusiveInMillis) {
  this.measureDurationScoped(name, null, durationInMillis, exclusiveInMillis);
};

Metrics.prototype.toUnscopedData = function () {
  var metricData = [];

  for (var name in this.unscoped) {
    if (this.unscoped.hasOwnProperty(name)) {
      metricData.push(this.unscoped[name].toData(this.metricIds));
    }
  }

  return metricData;
};

Metrics.prototype.toScopedData = function () {
  var metricData = [];

  for (var scope in this.scoped) {
    if (this.scoped.hasOwnProperty(scope)) {
      for (var name in this.scoped[scope]) {
        if (this.scoped[scope].hasOwnProperty(name)) {
          metricData.push(this.scoped[scope][name].toData(this.metricIds));
        }
      }
    }
  }

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
  for (var name in other.unscoped) {
    if (other.unscoped.hasOwnProperty(name)) {
      if (this.unscoped[name]) {
        this.unscoped[name].stats.merge(other.unscoped[name].stats);
      }
      else {
        this.unscoped[name] = other.unscoped[name];
      }
    }
  }

  for (var scope in other.scoped) {
    if (other.scoped.hasOwnProperty(scope)) {
      for (name in other.scoped[scope]) {
        if (other.scoped[scope].hasOwnProperty(name)) {
          var resolved = this.resolveScope(scope);
          if (resolved[name]) {
            resolved[name].stats.merge(other.scoped[scope][name].stats);
          }
          else {
            resolved[name] = other.scoped[scope][name];
          }
        }
      }
    }
  }
};

module.exports = Metrics;
