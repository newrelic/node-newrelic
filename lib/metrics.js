'use strict';

var path             = require('path')
  , Stats            = require(path.join(__dirname, 'stats.js'))
  , ApdexStats       = require(path.join(__dirname, 'stats', 'apdex.js'))
  , MetricNormalizer = require(path.join(__dirname, 'metrics', 'normalizer.js'))
  , RenameRules      = require(path.join(__dirname, 'metrics', 'rename-rules.js'))
  ;

function Metrics(apdexT, renamer, normalizer) {
  this.lastSendTime = Date.now();

  this.apdexT  = apdexT || 0;
  this.renamer = renamer || new RenameRules();
  this.normalizer = normalizer || new MetricNormalizer();

  // {name : stats}
  this.unscoped = {};
  // {scope : {name : stats}}
  this.scoped = {};
}

Metrics.prototype._resolve = function (scope) {
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
  if (!name) throw new Error('Metrics must be named');

  return this._resolve(scope)[name];
};

Metrics.prototype.getOrCreateMetric = function (name, scope) {
  if (!name) throw new Error('Metrics must be named');

  var resolved = this._resolve(scope);

  if (!resolved[name]) resolved[name] = new Stats();

  return resolved[name];
};

Metrics.prototype.getOrCreateApdexMetric = function (name, scope) {
  var resolved = this._resolve(scope);

  if (!resolved[name]) resolved[name] = new ApdexStats(this.apdexT);

  return resolved[name];
};

Metrics.prototype.measureMilliseconds = function (name,
                                                  scope,
                                                  durationInMillis,
                                                  exclusiveInMillis) {
  var metric = this.getOrCreateMetric(name, scope);
  metric.recordValueInMillis(durationInMillis, exclusiveInMillis);
  return metric;
};

Metrics.prototype.measureBytes = function (name, sizeInBytes) {
  var metric = this.getOrCreateMetric(name);
  metric.recordValueInBytes(sizeInBytes);
  return metric;
};

Metrics.prototype.getUnscopedData = function (name) {
  if (!this.unscoped[name]) return;

  return [this.renamer.map(name), this.unscoped[name]];
};

Metrics.prototype.getScopedData = function (name, scope) {
  if (!this.scoped[scope][name]) return;

  return [this.renamer.map(name, scope), this.scoped[scope][name]];
};

/**
 * Return a serializable version of the unscoped metrics. Intended for use
 * by toJSON.
 */
Metrics.prototype.toUnscopedData = function () {
  var metricData = [];

  Object.keys(this.unscoped).forEach(function (name) {
    metricData.push(this.getUnscopedData(name));
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
      metricData.push(this.getScopedData(name, scope));
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
      this.unscoped[name].merge(other.unscoped[name]);
    }
    else {
      this.unscoped[name] = other.unscoped[name];
    }
  }, this);

  Object.keys(other.scoped).forEach(function (scope) {
    Object.keys(other.scoped[scope]).forEach(function (name) {
      if (other.scoped[scope][name]) {
        var resolved = this._resolve(scope);
        if (resolved[name]) {
          resolved[name].merge(other.scoped[scope][name]);
        }
        else {
          resolved[name] = other.scoped[scope][name];
        }
      }
    }, this);
  }, this);
};

module.exports = Metrics;
