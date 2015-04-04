'use strict'

var NAMES = require('../../metrics/names.js')

function recordWeb(segment, scope) {
  // in web metrics, scope is required


  var duration = segment.getDurationInMillis()
  var exclusive = segment.getExclusiveDurationInMillis()
  var transaction = segment.transaction
  var group = segment.partialName


  if (scope) {
    transaction.measure(scope, scope, duration, exclusive)
    transaction.measure(scope, null, duration, exclusive)
  }
  transaction.measure(NAMES.BACKGROUND + '/all', null, duration, exclusive)
  transaction.measure(NAMES.BACKGROUND + '/' + group + '/all', null, duration, exclusive)

}

module.exports = recordWeb
