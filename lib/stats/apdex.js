'use strict';

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

module.exports = ApdexStats;
