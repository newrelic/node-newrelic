'use strict'

var promInit = require('./promise')

var STATIC_PROMISE_METHODS = [
  'reject', 'resolve', 'all', 'any', 'some', 'map', 'reduce', 'filter', 'reduceRight'
]

var WHEN_SPEC = {
  name: 'when',
  constructor: 'Promise',
  executor: true,
  $proto: {
    then: ['then', 'done', 'spread', 'finally'],
    catch: ['catch']
  },
  $static: {
    cast: STATIC_PROMISE_METHODS,
    $copy: STATIC_PROMISE_METHODS.concat(['_defer', '_handler', 'race', '_traverse',
      '_visitRemaining', 'onFatalRejection', 'onPotentiallyUnhandledRejectionHandled',
      'onPotentiallyUnhandledRejection', 'exitContext', 'enterContext', 'createContext',
      'settle', 'iterate', 'unfold', 'never'])
  },
  $library: {
    cast: STATIC_PROMISE_METHODS
  }
}

module.exports = function initialize(agent, library) {
  promInit(agent, library, WHEN_SPEC)
}
