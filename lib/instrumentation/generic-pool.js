'use strict'

var path    = require('path')
  , shimmer = require('../shimmer')
  

module.exports = function initialize(agent, generic) {
  shimmer.wrapMethod(generic, 'generic-pool', 'Pool', function cb_wrapMethod(Pool) {
    return function cls_wrapMethod() {
      var pooler = Pool.apply(this, arguments)

      shimmer.wrapMethod(pooler, 'Pool', 'acquire', function cb_wrapMethod(acquire) {
        return function propagateTransactionThroughPool(callback, priority) {
          if (typeof callback === 'function') {
            /* See adjustCallback in generic-pool.js for the motivation behind
             * this grotesque hack. Tl;dr: depending on Function.length is evil.
             */
            var proxied = agent.tracer.callbackProxy(callback)
            switch (callback.length) {
              case 2:
                callback = function moveAlongNothingToSeeHere(error, client) {
                  return proxied.call(this, error, client)
                }
                break
              case 1:
                callback = function moveAlongNothingToSeeHere(client) {
                  return proxied.call(this, client)
                }
                break
              default:
                callback = proxied
            }
          }

          return acquire.call(this, callback, priority)
        }
      })

      return pooler
    }
  })
}
