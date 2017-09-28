'use strict'

var wrap = require('../../shimmer').wrapMethod

module.exports = initialize

function initialize(agent, inspector) {
  if (!((inspector || {}).Session || {}).prototype) {
    return false
  }

  wrap(
    inspector.Session.prototype,
    'inspector.Session.prototype',
    'post',
    function wrapPost(fn) {
      return agent.tracer.wrapFunctionNoSegment(fn, 'post')
    }
  )
}
