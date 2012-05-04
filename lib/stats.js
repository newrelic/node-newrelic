var path  = require('path')
  , trace = require(path.join(__dirname, 'trace'))
  ;

var BYTES_PER_MB = 1048576;

function Stats() {
  var total = 0;
  var totalExclusive = 0;
  var min = 0;
  var max = 0;
  var sumOfSquares = 0;
  var callCount = 0;

  this.recordValue = function (totalTime, exclusiveTime) {
    if (exclusiveTime !== 0 && !exclusiveTime) {
      exclusiveTime = totalTime;
    }
    sumOfSquares = sumOfSquares + (totalTime*totalTime);
    if (callCount > 0) {
      min = Math.min(totalTime, min);
    }
    else {
      min = totalTime;
    }
    callCount++;
    total += totalTime;
    totalExclusive += exclusiveTime;
    max = Math.max(totalTime, max);
  };

  this.incrementCallCount = function (count) {
    callCount += (count ? count : 1);
  };

  this.merge = function (stats) {
    var arr = stats.toJSON();
    var otherCallCount = arr[0];
    var otherTotal = arr[1];
    var otherTotalExclusive = arr[2];
    var otherMin = arr[3];
    var otherMax = arr[4];
    var otherSumOfSquares = arr[5];

    if (otherCallCount > 0) {
      if (callCount > 0) {
        min = Math.min(min, otherMin);
      }
      else {
        min = otherMin;
      }
    }
    max = Math.max(max, otherMax);

    callCount += otherCallCount;
    total += otherTotal;
    totalExclusive += otherTotalExclusive;

    sumOfSquares += otherSumOfSquares;
  };

  this.toJSON = function () {
    return [callCount, total, totalExclusive, min, max, sumOfSquares];
  };
}

Stats.prototype.recordValueInMillis = function (totalTime, exclusiveTime) {
  this.recordValue(totalTime / 1000, exclusiveTime || exclusiveTime === 0 ? exclusiveTime / 1000 : null);
};

Stats.prototype.recordTimer = function (timer) {
  this.recordValueInMillis(timer.getDurationInMillis());
};

Stats.prototype.recordValueInBytes = function (bytes, exclusiveBytes) {
  exclusiveBytes = exclusiveBytes || bytes;
  this.recordValue(bytes / BYTES_PER_MB, exclusiveBytes / BYTES_PER_MB);
};


function ApdexStats(apdexT) {
  var satisfying = 0;
  var tolerating = 0;
  var frustrating = 0;
  var apdexTInMillis = apdexT * 1000;

  this.recordValueInMillis = function (time) {
    if (time <= apdexTInMillis) { // record_apdex_s
      satisfying++;
    } else if (time <= 4 * apdexTInMillis) { // record_apdex_t
      tolerating++;
    } else { // record_apdex_f
      frustrating++;
    }
  };

  this.merge = function (stats) {
    var otherValues = stats.toJSON();
    satisfying += otherValues[0];
    tolerating += otherValues[1];
    frustrating += otherValues[2];
  };

  this.incrementFrustrating = function () {
    frustrating++;
  };

  this.toJSON = function () {
    return [satisfying, tolerating, frustrating, 0, 0, 0];
  };
}

function MetricSpec(name, scope) {
  this.toJSON = function () {
    var hash = {'name' : name};
    if (scope) {
      hash.scope = scope;
    }
    return hash;
  };
}

var NOOP_APDEX_STATS = new ApdexStats(0);

function StatsCollection(statsEngine) {
  this.statsEngine = statsEngine;
  this.metricStats = {};
}

StatsCollection.prototype.merge = function (_stats) {
  var metricStats = this.metricStats;
  var stats = _stats.metricStats;
  for (var name in stats) {
    if (stats.hasOwnProperty(name)) {
      var existing = metricStats[name];
      if (existing) {
        existing.merge(stats[name]);
      } else {
        metricStats[name] = stats[name];
      }
    }
  }
};

StatsCollection.prototype.toJSON = function () {
  return this.metricStats;
};

StatsCollection.prototype.byName = function (name) {
  var metricStats = this.metricStats;
  var stats = metricStats[name];
  if (!stats) {
    stats = new Stats();
    metricStats[name] = stats;
  }
  return stats;
};

StatsCollection.prototype.getApdexStats = function (name) {
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

StatsCollection.prototype.getMetricData = function (metricIds, scope) {
  var metricStats = this.metricStats;
  var md = [];
  for (var name in metricStats) {
    if (metricStats.hasOwnProperty(name)) {
      var spec = new MetricSpec(name, scope);
      if (metricIds) {
        var id = metricIds[[name, scope]];
        if (id) {
          spec = id;
        }
      }
      // var spec = new MetricSpec(name, scope);
      // MetricData is just an array of spec and stats
      md.push([spec, metricStats[name]]);
    }
  }
  return md;
};

// used as a wrapper when sending metric data and merging it back if the send fails
function MetricDataSet(unscopedStats, scopedStats, metricIds) {
  this.unscopedStats = unscopedStats;
  this.scopedStats = scopedStats;

  this.toJSON = function () {
    var md = this.unscopedStats.getMetricData(metricIds);
    for (var scope in this.scopedStats) {
      if (this.scopedStats.hasOwnProperty(scope)) {
        md = md.concat(this.scopedStats[scope].getMetricData(metricIds, scope));
      }
    }
    return md;
  };
}

function StatsEngine(logger) {
  var self = this;

  var lastSendTime = Date.now();

  this.scopedStats = {};
  this.unscopedStats = new StatsCollection(this);
  this.metricIds = {};

  this.clear = function () {
    this.unscopedStats = new StatsCollection(this);
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
      collection = new StatsCollection(this);
      this.scopedStats[scope] = collection;
    }
    return collection;
  };

  this.getMetricData = function () {
    var md = new MetricDataSet(this.unscopedStats, this.scopedStats, this.metricIds);
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

exports.MetricDataSet = MetricDataSet;

exports.Stats = Stats;

exports.StatsEngine = StatsEngine;

exports.StatsCollection = StatsCollection;
