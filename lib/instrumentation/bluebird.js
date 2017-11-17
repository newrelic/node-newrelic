'use strict'

var promInit = require('./promise')
var shimmer = require('../shimmer')

var BLUEBIRD_SPEC = {
  name: 'bluebird',
  constructor: 'Promise',
  $proto: {
    then: ['then', 'done', 'spread', 'all', 'asCallback', 'nodeify', 'finally', 'lastly'],
    catch: ['catch', 'caught', 'error'],

    // _resolveFromResolver is in bluebird 2.x
    // _execute is in bluebird 3.x
    executor: ['_execute', '_resolveFromResolver']
  },
  $static: {
    cast: [
      'all', 'any', 'attempt', 'cast', 'each', 'filter', 'fromCallback', 'fromNode', 'fulfilled',
      'join', 'map', 'mapSeries', 'props', 'race', 'reduce', 'reject', 'rejected', 'resolve',
      'some', 'try'
    ]
  }
}

module.exports = function initialize(agent, bluebird) {
  promInit(agent, bluebird, BLUEBIRD_SPEC)

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
}

module.exports.SPEC = BLUEBIRD_SPEC
