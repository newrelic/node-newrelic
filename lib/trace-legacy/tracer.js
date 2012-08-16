'use strict';

var path  = require('path')
  , util  = require('util')
  , Timer = require(path.join(__dirname, 'timer'))
  , getRawStack = require(path.join(__dirname, 'stack-helper'))
  ;

var noop = function () {};

function appendToStackAndFindParent(tracer, error) {
  var stack = getRawStack(error);
  // append the tracer at the top of the stack
  stack[0].fun.__NR_TRACER = tracer;
  // start at one to skip the top of the stack (we'd find the current tracer)
  for (var i = 1, len = stack.length; i < len; i++) {
    if (stack[i].fun.__NR_TRACER) {
      return stack[i].fun.__NR_TRACER;
    }
  }
}


/**
 * Tracer: Transaction controller.
 */
function Tracer(transaction, metricNameOrCallback) {
  Timer.call(this);

  this.transaction = transaction;
  this.metricNameOrCallback = metricNameOrCallback;

  this._childDurationInMillis = 0;

  // Only allow the manipulation of this transaction if it hasn't
  // yet completed.
  if (transaction.push(this)) {
    this.appendToStack = function (error) {
      this._parent = appendToStackAndFindParent(this, error);
    };

    this.popFromTransaction = function () {
      transaction.pop(this);
      if (this._parent) this._parent.childFinished(this);
    };
  }
  else {
    this.appendToStack = this.popFromTransaction = noop;
  }
}
util.inherits(Tracer, Timer);

Tracer.prototype.toJSON = function () {
  return [this.metricNameOrCallback,
          this.getDurationInMillis(),
          this.getExclusiveDurationInMillis()];
};

Tracer.prototype.getName = function () {
  return util.inspect(this.metricNameOrCallback);
};

Tracer.prototype.recordMetrics = function (metrics, scope) {
  var metricNameOrCallback = this.metricNameOrCallback;
  if (typeof(metricNameOrCallback) === 'string') {
    metrics.measureDurationScoped(metricNameOrCallback,
                                  scope,
                                  this.getDurationInMillis(),
                                  this.getExclusiveDurationInMillis());
  }
  else if (metricNameOrCallback) {
    metricNameOrCallback(this, metrics);
  }
};

Tracer.prototype.getExclusiveDurationInMillis = function () {
  return Math.max(0, this.getDurationInMillis() - this._childDurationInMillis);
};

Tracer.prototype.childFinished = function (child) {
  this._childDurationInMillis += child.getDurationInMillis();
};

Tracer.prototype.finish = function () {
  this.stop();
  this.popFromTransaction();
};

module.exports = Tracer;
