'use strict'

var shimmer = require('../shimmer')

module.exports = function initialize(agent, bluebird) {
  var tracer = agent.tracer

  shimmer.wrapMethod(
    bluebird.prototype,
    'bluebird.prototype',
    '_then',
    function wrapThen(original) {
      return tracer.wrapFunctionNoSegment(original, null, wrapper)
    }
  )

  function wrapper(args) {
    var onResolve = args[0]
    if (typeof onResolve === 'function') {
      args[0] = tracer.bindFunction(onResolve)
    }

    var onReject = args[1]
    if (typeof onReject === 'function') {
      args[1] = tracer.bindFunction(onReject)
    }

    return args
  }
}
