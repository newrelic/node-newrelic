'use strict';

/**
 * Explicit enumeration of the states a transaction can be in:
 *
 * PENDING upon instantiation (implicitly, no start time set)
 * RUNNING while timer is running (implicitly, start time is set but no stop
 *   time is set).
 * STOPPED timer has been completeted (implicitly, start time and stop time
 *   are set, but the timer has not yet been harvested).
 * DEAD timer has been harvested and can only have its duration read.
 */
var PENDING = 1
  , RUNNING = 2
  , STOPPED = 3
  , DEAD    = 4
  ;

function hrToMillis(hr) {
  // process.hrTime gives you [second, nanosecond] duration pairs
  return (hr[0] * 1000) + (hr[1] / 1000 / 1000);
}

/**
 * A mildly tricksy timer that tracks its own state and allows its duration
 * to be set manually.
 */
function Timer() {
  this.state = PENDING;
}

Timer.prototype.begin = function () {
  if (this.state > PENDING) return;

  this.start   = Date.now();
  this.hrStart = process.hrtime();
  this.state   = RUNNING;
};

Timer.prototype.end = function () {
  if (this.state > RUNNING) return;

  this.hrDuration = process.hrtime(this.hrStart);
  this.state = STOPPED;
};

Timer.prototype.harvest = function () {
  if (this.state === DEAD) throw new Error("Can't harvest a dead timer.");

  if (this.state < STOPPED) this.end();
  this.state = DEAD;

  return this.getDurationInMillis();
};

/**
 * @return {bool} Is this timer currently running?
 */
Timer.prototype.isRunning = function () {
  return this.state === RUNNING;
};

/**
 * @return {bool} Is this timer still alive?
 */
Timer.prototype.isActive = function () {
  return this.state < STOPPED;
};

Timer.prototype.setDurationInMillis = function (duration, start) {
  if (this.state > RUNNING) return;
  this.state = STOPPED;

  this.durationInMillis = duration;
  this.start = start;
};

Timer.prototype.getDurationInMillis = function () {
  switch (this.state) {
  case PENDING:
    return 0;

  case RUNNING:
    return hrToMillis(process.hrtime(this.hrStart));

  case STOPPED:
  case DEAD:
    if (!this.durationInMillis) {
      this.durationInMillis = hrToMillis(this.hrDuration);
    }

    return this.durationInMillis;
  }
};

/**
 * @return {Array} 2-tuple of start time in milliseconds, end time in
 *                 milliseconds.
 */
Timer.prototype.toRange = function () {
  return [this.start, this.start + this.getDurationInMillis()];
};

module.exports = Timer;
