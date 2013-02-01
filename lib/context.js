'use strict';

/**
 * CONTEXT
 *
 * This does very little right now except act as a shared state used
 * by all the tracers in effect to keep track of the current transaction
 * and trace segment. The exit call is VERY IMPORTANT, because it is
 * how the proxying methods in the tracer know whether or not a call
 * is part of a transaction / segment.
 *
 * The relevant code in the Tracer can be adapted to use domains instead
 * of Context very easily, which should make it easy to support both
 * 0.8 and earlier versions from most of the same code.
 */
function Context(debug) {
  // used to ensure that entries and exits remain paired
  if (debug) this.stack = [];
}

Context.prototype.enter = function (state) {
  this.state = state;

  if (this.stack) this.stack.push(state);

  if (state.domain) state.domain.enter();
};

Context.prototype.exit = function (state) {
  if (state.domain) state.domain.exit();

  if (this.stack) {
    var top = this.stack.pop();
    if (top !== state) throw new Error("You must exit every context you enter.");
  }

  delete this.state;
};

module.exports = Context;
