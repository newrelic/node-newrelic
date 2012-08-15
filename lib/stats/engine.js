'use strict';

var path          = require('path')
  , logger        = require(path.join(__dirname, '..', 'logger'))
  , trace         = require(path.join(__dirname, '..', 'trace'))
  , Collection    = require(path.join(__dirname, 'collection'))
  ;

function StatsEngine() {
  this.lastSendTime = Date.now();
  this.scopedStats = {};
  this.unscopedStats = new Collection(this);
  this.metricIds = {};

  trace.addTransactionListener(this, this.onTransactionFinished);
}

StatsEngine.prototype.clear = function () {
  this.unscopedStats = new Collection(this);
  this.scopedStats = {};
};

StatsEngine.prototype.onConnect = function (params) {
  this.apdexT = params.apdex_t;

  if (this.apdexT) logger.info("ApdexT changed from server, is now " + this.apdexT);
};

StatsEngine.prototype.onTransactionFinished = function (transaction) {
  this.unscopedStats.merge(transaction.unscopedStats);
  this.statsByScope(transaction.scope).merge(transaction.scopedStats);
};

StatsEngine.prototype.statsByScope = function (scope) {
  var collection = this.scopedStats[scope];
  if (!collection) {
    collection = new Collection(this);
    this.scopedStats[scope] = collection;
  }
  return collection;
};

StatsEngine.prototype.toJSON = StatsEngine.prototype.getMetricData = function () {
  var md = this.unscopedStats.getMetricData(this.metricIds);
  for (var scope in this.scopedStats) {
    if (this.scopedStats.hasOwnProperty(scope)) {
      md = md.concat(this.scopedStats[scope].getMetricData(this.metricIds, scope));
    }
  }
  return md;
};

StatsEngine.prototype.parseMetricIds = function (metricIdArray) {
  var self = this;

  this.lastSendTime = Date.now();
  metricIdArray.forEach(function (idToSpec) {
    var spec = idToSpec[0];
    var id = idToSpec[1];
    self.metricIds[[spec.name, spec.scope]] = id;
  });
  logger.debug("Parsed " + metricIdArray.length + " metric ids");
};

StatsEngine.prototype.mergeMetricData = function (metricDataSet) {
  this.unscopedStats.merge(metricDataSet.unscopedStats);
  for (var scope in metricDataSet.scopedStats) {
    if (metricDataSet.scopedStats.hasOwnProperty(scope)) {
      this.statsByScope(scope).merge(metricDataSet.scopedStats[scope]);
    }
  }
  logger.debug("Metric data merged");
};

module.exports = StatsEngine;
