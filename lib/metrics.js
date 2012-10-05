'use strict';

var path             = require('path')
  , logger           = require(path.join(__dirname, 'logger')).child({component : 'metrics'})
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

Metrics.prototype.measureDurationScoped = function (name, scope, durationInMillis, exclusiveInMillis) {
  var metric = this.getOrCreateMetric(name, scope);

  metric.stats.recordValueInMillis(durationInMillis, exclusiveInMillis);
};

Metrics.prototype.measureDurationUnscoped = function (name, durationInMillis, exclusiveInMillis) {
  this.measureDurationScoped(name, null, durationInMillis, exclusiveInMillis);
};

Metrics.prototype.measureSizeUnscoped = function (name, sizeInBytes) {
  var metric = this.getOrCreateMetric(name);

  metric.stats.recordValueInBytes(sizeInBytes);
};

/**
 * Return a serializable version of the unscoped metrics. Intended for use
 * by Metric.toJSON.
 */
Metrics.prototype.toUnscopedData = function () {
  var metricData = [];

  for (var name in this.unscoped) {
    if (this.unscoped.hasOwnProperty(name)) {
      metricData.push(this.unscoped[name].toData(this.renamer));
    }
  }

  return metricData;
};

/**
 * Return a serializable version of the scoped metrics. Intended for use
 * by Metric.toJSON.
 */
Metrics.prototype.toScopedData = function () {
  var metricData = [];

  for (var scope in this.scoped) {
    if (this.scoped.hasOwnProperty(scope)) {
      for (var name in this.scoped[scope]) {
        if (this.scoped[scope].hasOwnProperty(name)) {
          metricData.push(this.scoped[scope][name].toData(this.renamer));
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

Metrics.prototype.externalMetrics = function (host, library) {
  if (!host) {
    logger.error('External request metrics need to be associated with a host. Not measuring.');
    return function noop() {};
  }

  return function (segment, scope) {
    var duration = segment.getDurationInMillis();

    this.measureDurationUnscoped('External/all', duration);

    var rollupName = 'External/all';
    if (segment.trace.transaction.isWeb()) {
      rollupName += '/Web';
    }
    else {
      rollupName += '/Other';
    }
    this.measureDurationUnscoped(rollupName, duration);
    this.measureDurationUnscoped('External/' + host + '/all', duration);

    var metricName = "External/" + host + '/' + library;
    this.measureDurationUnscoped(metricName, duration);
    this.measureDurationScoped(metricName, scope, duration);
  }.bind(this);
};

module.exports = Metrics;
