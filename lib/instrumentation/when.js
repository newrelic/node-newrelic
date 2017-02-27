'use strict'

var promInit = require('./promise')

var STATIC_PROMISE_METHODS = ['reject', 'resolve', 'all', 'any', 'some', 'map', 'reduce',
  'filter']

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
    $copy: STATIC_PROMISE_METHODS
  },
  $library: {
    cast: STATIC_PROMISE_METHODS
  }
}

module.exports = function initialize(agent, library) {
  promInit(agent, library, WHEN_SPEC)
}
