'use strict'

module.exports = function initialize(agent, generic, moduleName, shim) {
  var proto = generic && generic.Pool && generic.Pool.prototype

  function wrapPool(pool) {
    shim.wrap(pool, 'acquire', function wrapAcquire(shim, original) {
      return function wrappedAcquire(callback, priority) {
        return original.call(this, shim.bindSegment(callback), priority)
      }
    })
  }

  if (proto && proto.acquire) {
    wrapPool(proto)
  } else {
    shim.wrapReturn(generic, 'Pool', function wrapPooler(shim, original, name, pooler) {
      wrapPool(pooler)
    })
  }
}
