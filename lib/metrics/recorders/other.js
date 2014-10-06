'use strict'

var path  = require('path')
  , NAMES = require('../../metrics/names.js')
  

/*
 *
 * CONSTANTS
 *
 */
var TO_MILLIS = 1e3

function recordWeb(segment, scope) {
  // in web metrics, scope is required


  var duration         = segment.getDurationInMillis()
    , exclusive        = segment.getExclusiveDurationInMillis()
    , transaction      = segment.trace.transaction
    , group            = segment.partialName
    

  if (scope) {
    transaction.measure(scope,      scope, duration, exclusive)
    transaction.measure(scope,       null, duration, exclusive)
  }
  transaction.measure(NAMES.BACKGROUND + '/all', null, duration, exclusive)
  transaction.measure(NAMES.BACKGROUND + '/' + group + '/all',  null, duration, exclusive)

}

module.exports = recordWeb
