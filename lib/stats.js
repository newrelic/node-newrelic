'use strict';

var BYTES_PER_MB = 1048576;

function Stats() {
  this.total = 0;
  this.totalExclusive = 0;
  this.min = 0;
  this.max = 0;
  this.sumOfSquares = 0;
  this.callCount = 0;
}

Stats.prototype.recordValue = function (totalTime, exclusiveTime) {
  if (exclusiveTime !== 0 && !exclusiveTime) exclusiveTime = totalTime;

  this.sumOfSquares += (totalTime * totalTime);
  if (this.callCount > 0) {
    this.min = Math.min(totalTime, this.min);
  }
  else {
    this.min = totalTime;
  }
  this.callCount += 1;
  this.total += totalTime;
  this.totalExclusive += exclusiveTime;
  this.max = Math.max(totalTime, this.max);
};

Stats.prototype.incrementCallCount = function (count) {
  this.callCount += (count ? count : 1);
};

Stats.prototype.merge = function (stats) {
  var arr = stats.toJSON();
  var otherCallCount = arr[0];
  var otherTotal = arr[1];
  var otherTotalExclusive = arr[2];
  var otherMin = arr[3];
  var otherMax = arr[4];
  var otherSumOfSquares = arr[5];

  if (otherCallCount > 0) {
    if (this.callCount > 0) {
      this.min = Math.min(this.min, otherMin);
    }
    else {
      this.min = otherMin;
    }
  }
  this.max = Math.max(this.max, otherMax);

  this.callCount += otherCallCount;
  this.total += otherTotal;
  this.totalExclusive += otherTotalExclusive;

  this.sumOfSquares += otherSumOfSquares;
};

Stats.prototype.toJSON = function () {
  return [this.callCount, this.total, this.totalExclusive, this.min, this.max, this.sumOfSquares];
};

Stats.prototype.recordValueInMillis = function (totalTime, exclusiveTime) {
  this.recordValue(totalTime / 1000, exclusiveTime || exclusiveTime === 0 ? exclusiveTime / 1000 : null);
};

Stats.prototype.recordValueInBytes = function (bytes, exclusiveBytes) {
  exclusiveBytes = exclusiveBytes || bytes;
  this.recordValue(bytes / BYTES_PER_MB, exclusiveBytes / BYTES_PER_MB);
};

module.exports = Stats;
