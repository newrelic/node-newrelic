'use strict'

var path           = require('path')
  , shimmer        = require('../shimmer.js')
  , recordMemcache = require('../metrics/recorders/memcached.js')
  , MEMCACHE       = require('../metrics/names.js').MEMCACHE
  

function wrapKeys(metacall) {
  if (metacall.key) {
    return [metacall.key]
  }
  else if (metacall.multi) {
    return metacall.command.split(' ').slice(1)
  }
  else {
    return []
  }
}

/**
 * Thanks to Hernan Silberman!
 *
 * instrument the memcached driver to intercept calls and keep stats on them.
 */
module.exports = function initialize(agent, memcached) {
  var tracer = agent.tracer

  shimmer.wrapMethod(memcached && memcached.prototype,
                     'memcached.prototype',
                     'command',
                     function cb_wrapMethod(command) {
    return tracer.segmentProxy(function cb_segmentProxy() {
      if (!tracer.getTransaction()) return command.apply(this, arguments)

      /* The 'command' function will be called with a single function argument.
       * That function returns a simple object describing the memcached call.
       * Call that function to get that call description.
       */
      var metacall = arguments[0]()
        , name     = MEMCACHE.OPERATION + (metacall.type || 'Unknown')
        , segment  = tracer.addSegment(name, recordMemcache)
        , keys     = wrapKeys(metacall)
        

      /* capture connection info for datastore instance metric
       *
       * ONLY do this if there's only one connection for the driver,
       * because that's the only way to know for sure which shard a given
       * key was fetched from. Heuristic and sucky, but truthful.
       */
      if (this.connections && Object.keys(this.connections).length === 1) {
        var location = Object.keys(this.connections)[0].split(':')
        segment.host = location[0]
        segment.port = location[1]
      }

      if (agent.config.capture_params &&
          keys.length > 0 &&
          agent.config.ignored_params.indexOf('key') === -1) {
        segment.parameters.key = JSON.stringify(keys)
      }

      /* Memcached's call description includes a callback to apply when the
       * operation is concluded. Wrap that to trace the duration of the
       * operation.
       */
      shimmer.wrapMethod(metacall, 'metacall', 'callback', function cb_wrapMethod(kallback) {
        return tracer.callbackProxy(function wrappedMemcachedCallback() {
          var returned = kallback.apply(this, arguments)
          segment.end()
          return returned
        })
      })

      // rewrap the metacall for the command object
      var rewrapped = function rewrapped() { return metacall; }

      // finally, execute the original command
      return command.call(this, rewrapped)
    })
  })
}
