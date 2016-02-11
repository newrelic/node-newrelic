'use strict'

var wrap = require('../shimmer').wrapMethod

module.exports = initialize

function initialize(agent, Q) {
  if (Q.nextTick) {
    // The wrap() call for nextTick wipes the sub-function.  Save a reference
    // now so it can be restored later
    var savedRunAfter = Q.nextTick.runAfter

    wrap(Q, 'Q', 'nextTick', function wrapUninstrumented(original, method) {
      return agent.tracer.wrapFunctionFirstNoSegment(original, method)
    })

    if (savedRunAfter) {
      Q.nextTick.runAfter = savedRunAfter;
      wrap(Q.nextTick, 'Q.nextTick', 'runAfter', function wrapUninstrumented(original, method) {
        return agent.tracer.wrapFunctionFirstNoSegment(original, method)
      })
    }
  }
}
