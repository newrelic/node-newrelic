'use strict';

// used as a wrapper when sending metric data and merging it back if the send fails
function MetricDataSet(unscopedStats, scopedStats, metricIds) {
  this.unscopedStats = unscopedStats;
  this.scopedStats = scopedStats;
  this.metricIds = metricIds;
}

MetricDataSet.prototype.toJSON = function () {
  var md = this.unscopedStats.getMetricData(this.metricIds);
  for (var scope in this.scopedStats) {
    if (this.scopedStats.hasOwnProperty(scope)) {
      md = md.concat(this.scopedStats[scope].getMetricData(this.metricIds, scope));
    }
  }
  return md;
};

module.exports = MetricDataSet;
