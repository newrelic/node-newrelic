'use strict';

var path          = require('path')
  , logger        = require(path.join(__dirname, '..', 'logger'))
  , trace         = require(path.join(__dirname, '..', 'trace'))
  , Collection    = require(path.join(__dirname, 'collection'))
  , MetricDataSet = require(path.join(__dirname, '..', 'metric', 'data-set'))
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

  if (this.apdexT) logger.info("ApdexT is " + this.apdexT);
};

StatsEngine.prototype.harvest = function (connection) {
  logger.debug('running harvest cycle to collect and submit statistics');
  var md = this.getMetricData();
  this.clear();
  connection.sendMetricData(this.lastSendTime / 1000, Date.now() / 1000, md);
};

StatsEngine.prototype.statsByScope = function (scope) {
  var collection = this.scopedStats[scope];
  if (!collection) {
    collection = new Collection(this);
    this.scopedStats[scope] = collection;
  }
  return collection;
};

StatsEngine.prototype.getMetricData = function () {
  return new MetricDataSet(this.unscopedStats, this.scopedStats, this.metricIds);
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

StatsEngine.prototype.onTransactionFinished = function (transaction) {
  this.unscopedStats.merge(transaction.unscopedStats);
  this.statsByScope(transaction.scope).merge(transaction.scopedStats);
};

StatsEngine.prototype.toJSON = function () {
  return new MetricDataSet(this.unscopedStats, this.scopedStats, this.metricIds);
};

module.exports = StatsEngine;
