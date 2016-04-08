'use strict'

var promInit = require('./promise')

var BLUEBIRD_SPEC = {
  name: 'global',
  constructor: 'Promise',
  $proto: {
    then: '_then',
    // _resolveFromResolver is in bluebird 2.x
    // _execute is in bluebird 3.x
    executor: ['_execute', '_resolveFromResolver']
  },
  $static: {
    resolve: ['resolve', 'fullfilled', 'cast'],
    reject: ['reject', 'rejected']
  }
}

module.exports = function initialize(agent, bluebird) {
  promInit(agent, bluebird, BLUEBIRD_SPEC)
}
