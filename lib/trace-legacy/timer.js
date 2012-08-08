'use strict';

/**
 * Timer: A simple object for encapsulating transaction duration.
 */
function Timer() {
  this.finished = false;
  this.start = Date.now();
}

Timer.prototype.stop = function () {
  if (this.finished) throw new Error('tried to stop finished timer.');

  this.end = Date.now();
  this.finished = true;
};

Timer.prototype.getDurationInMillis = function () {
  return this.end - this.start;
};

module.exports = Timer;
