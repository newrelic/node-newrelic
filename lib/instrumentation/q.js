'use strict'

var wrap = require('../shimmer').wrapMethod

module.exports = initialize

function initialize(agent, Q) {
  if (Q.nextTick) {
    wrap(Q, 'Q.nextTick', 'nextTick', function wrapUninstrumented(original, method) {
      return agent.tracer.wrapFunctionFirstNoSegment(original, method)
    })
  }
}
