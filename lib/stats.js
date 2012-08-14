'use strict';

var BYTES_PER_MB = 1024 * 1024;

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

  if (this.callCount > 0) {
    this.min = Math.min(totalTime, this.min);
  }
  else {
    this.min = totalTime;
  }
  this.max = Math.max(totalTime, this.max);

  this.sumOfSquares   += (totalTime * totalTime);
  this.callCount      += 1;
  this.total          += totalTime;
  this.totalExclusive += exclusiveTime;
};

Stats.prototype.recordValueInMillis = function (totalTime, exclusiveTime) {
  this.recordValue(totalTime / 1000, exclusiveTime || exclusiveTime === 0 ? exclusiveTime / 1000 : null);
};

Stats.prototype.recordValueInBytes = function (bytes, exclusiveBytes) {
  exclusiveBytes = exclusiveBytes || bytes;
  this.recordValue(bytes / BYTES_PER_MB, exclusiveBytes / BYTES_PER_MB);
};

Stats.prototype.incrementCallCount = function (count) {
  this.callCount += (count ? count : 1);
};

Stats.prototype.merge = function (other) {
  if (other.callCount > 0) {
    if (this.callCount > 0) {
      this.min = Math.min(this.min, other.min);
    }
    else {
      this.min = other.min;
    }
  }
  this.max = Math.max(this.max, other.max);

  this.total          += other.total;
  this.totalExclusive += other.totalExclusive;
  this.sumOfSquares   += other.sumOfSquares;
  this.callCount      += other.callCount;
};

Stats.prototype.toJSON = function () {
  return [
    this.callCount,
    this.total,
    this.totalExclusive,
    this.min,
    this.max,
    this.sumOfSquares
  ];
};

module.exports = Stats;
