'use strict'

var stringifySync = require('../util/safe-json').stringifySync
var shimmer = require('../shimmer.js')
var urltils = require('../util/urltils.js')
var recordMemcache = require('../metrics/recorders/memcached.js')
var MEMCACHE = require('../metrics/names.js').MEMCACHE

function wrapKeys(metacall) {
  if (metacall.key) {
    return [metacall.key]
  } else if (metacall.multi) {
    return metacall.command.split(' ').slice(1)
  }

  return []
}

/**
 * Thanks to Hernan Silberman!
 *
 * instrument the memcached driver to intercept calls and keep stats on them.
 */
module.exports = function initialize(agent, memcached) {
  var tracer = agent.tracer

  shimmer.wrapMethod(
    memcached && memcached.prototype,
    'memcached.prototype',
    'command',
    function commandWrapper(original) {
      return tracer.wrapFunction(
        MEMCACHE.OPERATION + 'Unknown',
        recordMemcache,
        original,
        cb_wrapMethod
      )
    }
  )

  function cb_wrapMethod(segment, args, bind) {
    /* The 'command' function will be called with a single function argument.
     * That function returns a simple object describing the memcached call.
     * Call that function to get that call description.
     */
    var metacall = args[0]()
    var keys = wrapKeys(metacall)
    segment.name = MEMCACHE.OPERATION + (metacall.type || 'Unknown')

    /* capture connection info for datastore instance metric
     *
     * ONLY do this if there's only one connection for the driver,
     * because that's the only way to know for sure which shard a given
     * key was fetched from.
     */

    if (this.connections && Object.keys(this.connections).length === 1) {
      var location = Object.keys(this.connections)[0].split(':')
      segment.host = location[0]
      segment.port = location[1]
    }

    urltils.copyParameters(agent.config,
      {key: stringifySync(keys[0], 'Unknown')}, segment.parameters)

    /* Memcache call description includes a callback to apply when the
     * operation is concluded. Wrap that to trace the duration of the
     * operation.
     */
    shimmer.wrapMethod(
      metacall,
      'metacall',
      'callback',
      function cb_wrapMethod(callback) {
        return bind(callback, true, true)
      }
    )

    // rewrap the metacall for the command object
    args[0] = function rewrapped() {
      return metacall
    }

    // finally, execute the original command
    return args
  }
}
