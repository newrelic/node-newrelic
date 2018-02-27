'use strict'

var promInit = require('./promise')
var shimmer = require('../shimmer')

var BLUEBIRD_SPEC = {
  name: 'bluebird',
  constructor: 'Promise',
  $proto: {
    cast: [
      'all', 'any', 'bind', 'call', 'catchReturn', 'catchThrow', 'delay', 'get',
      'props', 'race', 'reflect', 'return', 'some', 'thenReturn', 'thenThrow',
      'throw', 'timeout'
    ],
    then: [
      'asCallback', 'done', 'each', 'filter', 'finally', 'lastly', 'map',
      'mapSeries', 'nodeify', 'reduce', 'spread', 'tap', 'tapCatch', 'then'
    ],
    catch: ['catch', 'caught', 'error'],

    // _resolveFromResolver is in bluebird 2.x
    // _execute is in bluebird 3.x
    executor: ['_execute', '_resolveFromResolver']
  },
  $static: {
    cast: [
      'all', 'any', 'attempt', 'bind', 'cast', 'delay', 'each', 'filter',
      'fromCallback', 'fromNode', 'fulfilled', 'join', 'map', 'mapSeries',
      'props', 'race', 'reduce', 'reject', 'rejected', 'resolve', 'some', 'try'
    ],
    promisify: [
      'coroutine', 'method', 'promisify'
    ]
  }
}

// XXX We are not instrumenting bluebird's cancellation feature because it seems
// rather like an edge case feature. It is not enabled by default and has strange
// effects on the interface. If our lack of support for cancellation becomes an
// issue we can revisit this decision.
//
// http://bluebirdjs.com/docs/api/cancellation.html


module.exports = function initialize(agent, bluebird) {
  promInit(agent, bluebird, BLUEBIRD_SPEC)

  // Using `getNewLibraryCopy` needs to trigger re-instrumenting.
  shimmer.wrapMethod(
    bluebird.Promise,
    'bluebird',
    'getNewLibraryCopy',
    function wrapNewCopy(original) {
      return function wrappedNewCopy() {
        var copy = original.apply(this, arguments)
        module.exports(agent, copy)
        return copy
      }
    }
  )

  // Need to copy over `coroutine.addYieldHandler`
  var Promise = bluebird.Promise
  var coroutine = Promise && Promise.coroutine
  if (shimmer.isWrapped(coroutine)) {
    var original = agent.tracer.getOriginal(coroutine)
    coroutine.addYieldHandler = original && original.addYieldHandler
  }
}

module.exports.SPEC = BLUEBIRD_SPEC
