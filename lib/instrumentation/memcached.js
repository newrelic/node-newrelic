'use strict'

var shimmer = require('../shimmer.js')
var recordMemcache = require('../metrics/recorders/memcached.js')
var MEMCACHE = require('../metrics/names.js').MEMCACHE


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

      var args = tracer.slice.apply(null, [arguments])

      /* The 'command' function will be called with a single function argument.
       * That function returns a simple object describing the memcached call.
       * Call that function to get that call description.
       */
      var metacall = args[0]()
      var server = args[1]
      var name = MEMCACHE.OPERATION + (metacall.type || 'Unknown')
      var segment = tracer.addSegment(name, recordMemcache)
      var keys = wrapKeys(metacall)

      /* capture connection info for datastore instance metric
       *
       * ONLY do this if there's only one connection for the driver,
       * because that's the only way to know for sure which shard a given
       * key was fetched from.
       */

      if (!server && this.connections) {
        var conns = Object.keys(this.connections)
        if (conns.length === 1) {
          server = conns[0]
        }
      }

      if (server) {
        var location = server.split(':')
        segment.host = location[0]
        segment.port = location[1]
      }

      if (agent.config.capture_params &&
          keys.length > 0 &&
          agent.config.ignored_params.indexOf('key') === -1) {
        segment.parameters.key = JSON.stringify(keys)
      }

      /* Memcache call description includes a callback to apply when the
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

      // re-wrap the meta-call for the command object
      args[0] = function rewrapped() { return metacall; }

      // finally, execute the original command
      return command.apply(this, args)
    })
  })
}
