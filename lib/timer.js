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
  ;

function hrToMillis(hr) {
  // process.hrTime gives you [second, nanosecond] duration pairs
  return (hr[0] * 1e3) + (hr[1] / 1e6);
}

/**
 * A mildly tricksy timer that tracks its own state and allows its duration
 * to be set manually.
 */
function Timer() {
  this.state = PENDING;
}

/**
 * Start measuring time elapsed.
 *
 * Uses process.hrtime if available, Date.now() otherwise.
 */
Timer.prototype.begin = function () {
  if (this.state > PENDING) return;

  this.start = Date.now();
  // need to put a guard on this for compatibility with Node < 0.8
  if (process.hrtime) this.hrstart = process.hrtime();
  this.state = RUNNING;
};

/**
 * End measurement.
 */
Timer.prototype.end = function () {
  if (this.state > RUNNING) return;

  if (process.hrtime) this.hrDuration = process.hrtime(this.hrstart);
  this.duration = Date.now() - this.start;
  this.state = STOPPED;
};

/**
 * Update the duration of the timer without ending it..
 */
Timer.prototype.touch = function () {
  if (this.state > RUNNING) return;

  if (process.hrtime) this.hrDuration = process.hrtime(this.hrstart);
  this.duration = Date.now() - this.start;
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

/**
 * When testing, it's convenient to be able to control time. Stops the timer
 * as a byproduct.
 *
 * @param {number} duration How long the timer ran.
 * @param {number} start When the timer started running (optional).
 */
Timer.prototype.setDurationInMillis = function (duration, start) {
  if (this.state > RUNNING) return;
  this.state = STOPPED;

  this.durationInMillis = duration;
  if (start || start === 0) {
    this.hrstart = [Math.floor(start / 1e3), start * 1e6];
    this.start = start;
  }
};

/**
 * Returns how long the timer has been running (if it's still running) or
 * how long it ran (if it's been ended or touched).
 */
Timer.prototype.getDurationInMillis = function () {
  if (this.state === PENDING) return 0;

  // only set by setDurationInMilis
  if (this.durationInMillis >= 0) return this.durationInMillis;

  // prioritize .end() and .touch()
  if (this.hrDuration) {
    return hrToMillis(this.hrDuration);
  }
  else if (this.duration) {
    return this.duration;
  }
  // fall back to time elapsed since start
  else if (process.hrtime) {
    return hrToMillis(process.hrtime(this.hrstart));
  }
  else {
    return Date.now() - this.start;
  }
};

/**
 * Get a single object containing the interval this timer was active.
 *
 * @return {Array} 2-tuple of start time in milliseconds, end time in
 *                 milliseconds.
 */
Timer.prototype.toRange = function () {
  return [this.start, this.start + this.getDurationInMillis()];
};

/**
 * Abstract away the nonsense related to having both an
 * hrtime start time and a regular one, and always return
 * milliseconds since start.
 *
 * @param {Timer} other The point relative to which this timer started.
 * @return {number} The offset in (floating-point) milliseconds.
 */
Timer.prototype.startedRelativeTo = function (other) {
  if (this.hrstart && other.hrstart && process.hrtime) {
    var s  = this.hrstart[0] - other.hrstart[0]
      , ns = this.hrstart[1] - other.hrstart[1]
      ;

    return hrToMillis([s, ns]);
  }
  else {
    return this.start - other.start;
  }
};

module.exports = Timer;
