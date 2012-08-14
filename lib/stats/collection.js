'use strict';

var path       = require('path')
  , Stats      = require(path.join(__dirname, '..', 'stats'))
  , ApdexStats = require(path.join(__dirname, 'apdex'))
  , Metric     = require(path.join(__dirname, '..', 'trace', 'metric'))
  ;

var NOOP_APDEX_STATS = new ApdexStats(0);

function Collection(statsEngine) {
  this.statsEngine = statsEngine;
  this.metricStats = {};
}

Collection.prototype.merge = function (_stats) {
  var metricStats = this.metricStats;
  var stats = _stats.metricStats;
  for (var name in stats) {
    if (stats.hasOwnProperty(name)) {
      var existing = metricStats[name];
      if (existing) {
        existing.merge(stats[name]);
      }
      else {
        metricStats[name] = stats[name];
      }
    }
  }
};

Collection.prototype.toJSON = function () {
  return this.metricStats;
};

Collection.prototype.byName = function (name) {
  var metricStats = this.metricStats;
  var stats = metricStats[name];
  if (!stats) {
    stats = new Stats();
    metricStats[name] = stats;
  }
  return stats;
};

Collection.prototype.getApdexStats = function (name) {
  var metricStats = this.metricStats;
  var stats = metricStats[name];
  if (!stats) {
    var apdexT = this.statsEngine.apdexT;
    if (apdexT) {
      stats = new ApdexStats(apdexT);
      metricStats[name] = stats;
    } else {
      return NOOP_APDEX_STATS;
    }
  }
  return stats;
};

Collection.prototype.getMetricData = function (metricIds, scope) {
  var metricStats = this.metricStats;
  var md = [];
  for (var name in metricStats) {
    if (metricStats.hasOwnProperty(name)) {
      var metric = new Metric(name, scope);
      if (metricIds) {
        var id = metricIds[[name, scope]];
        if (id) {
          metric = id;
        }
      }
      // var metric = new Metric(name, scope);
      // MetricData is just an array of spec and stats
      md.push([metric, metricStats[name]]);
    }
  }
  return md;
};

module.exports = Collection;
