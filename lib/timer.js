'use strict';

/**
 * Explicit enumeration of the states a transaction can be in:
 *
 * PENDING upon instantiation (implicitly, no start time set)
 * RUNNING while transaction is running (implicitly, start time is
 *   set but no stop time is set).
 * STOPPED transaction has been completeted (implicitly, start time
 *   and stop time are set, but the transaction has not yet been harvested)
 *
 * FIXME: determine whether it's necessary to have a specific state-tracking
 * variable at all.
 */
var PENDING = 1
  , RUNNING = 2
  , STOPPED = 3
  , DEAD    = 4
  ;

/**
 * A mildly tricksy timer that tracks its own state and allows its duration
 * to be set manually.
 */
function Timer() {
  this.state = PENDING;
  this.finish = 0;
  this.durationInMillis = 0;
}

Timer.prototype.begin = function () {
  if (this.state > PENDING) return;

  this.start = Date.now();
  this.state = RUNNING;
};

Timer.prototype.end = function () {
  if (this.state > RUNNING) return;

  this.finish = Date.now();
  this.state = STOPPED;
};

/**
 * @return {bool} Is this transaction still alive?
 */
Timer.prototype.isActive = function () {
  return this.state < STOPPED;
};

Timer.prototype.setDurationInMillis = function (duration) {
  if (this.state > RUNNING) return;

  this.durationInMillis = duration;
  this.state = STOPPED;
};

Timer.prototype.getDurationInMillis = function () {
  if (this.durationInMillis) {
    return this.durationInMillis;
  }
  else {
    return this.finish - this.start;
  }
};

module.exports = Timer;
