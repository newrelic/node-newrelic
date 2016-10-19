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
     * this uses the same server resolution method as the driver
     */

    if (this.HashRing && this.HashRing.get && metacall.key) {
      var location = this.HashRing.get(metacall.key).split(':')
      segment.captureDBInstanceAttributes(location[0], location[1], false)
    }

    urltils.copyParameters(
      agent.config,
      {
        key: stringifySync(keys[0], 'Unknown')
      },
      segment.parameters
    )

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
