var path   = require('path')
  , logger = require(path.join(__dirname, '..', 'logger'))
  , trace  = require(path.join(__dirname, '..', 'trace'))
  , stats  = require(path.join(__dirname, '..', 'stats'))
  ;

function StatsEngine() {
  var self = this;

  var lastSendTime = Date.now();

  this.scopedStats = {};
  this.unscopedStats = new stats.Collection(this);
  this.metricIds = {};

  this.clear = function () {
    this.unscopedStats = new stats.Collection(this);
    this.scopedStats = {};
  };

  this.onConnect = function (params) {
    self.apdexT = params.apdex_t;
    if (self.apdexT) {
      logger.info("ApdexT is " + self.apdexT);
    }
  };

  this.harvest = function (connection) {
    var md = this.getMetricData();
    connection.sendMetricData(lastSendTime / 1000, Date.now() / 1000, md);
  };

  this.statsByScope = function (scope) {
    var collection = this.scopedStats[scope];
    if (!collection) {
      collection = new stats.Collection(this);
      this.scopedStats[scope] = collection;
    }
    return collection;
  };

  this.getMetricData = function () {
    var md = new stats.MetricDataSet(this.unscopedStats, this.scopedStats, this.metricIds);
    this.clear();
    return md;
  };

  this.parseMetricIds = function (metricIdArray) {
    lastSendTime = Date.now();
    metricIdArray.forEach(function (idToSpec) {
      var spec = idToSpec[0];
      var id = idToSpec[1];
      self.metricIds[[spec.name, spec.scope]] = id;
    });
    logger.debug("Parsed " + metricIdArray.length + " metric ids");
  };

  this.mergeMetricData = function (metricDataSet) {
    self.unscopedStats.merge(metricDataSet.unscopedStats);
    for (var scope in metricDataSet.scopedStats) {
      if (metricDataSet.scopedStats.hasOwnProperty(scope)) {
        this.statsByScope(scope).merge(metricDataSet.scopedStats[scope]);
      }
    }
    logger.debug("Metric data merged");
  };

  this.onTransactionFinished = function (transaction) {
    self.unscopedStats.merge(transaction.unscopedStats);
    self.statsByScope(transaction.scope).merge(transaction.scopedStats);
  };

  trace.addTransactionListener(self, self.onTransactionFinished);
}

StatsEngine.prototype.toJSON = function () {
  return this.getMetricData();
};

exports.reset = function () {
  return exports.engine = new StatsEngine();
};

exports.reset();
