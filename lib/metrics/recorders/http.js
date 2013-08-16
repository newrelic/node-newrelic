'use strict';

var path  = require('path')
  , NAMES = require(path.join(__dirname, '..', '..', 'metrics', 'names.js'))
  ;

function recordWeb(segment, scope) {
  // in web metrics, scope is required
  if (!scope) return;

  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    , partial     = segment.partialName
    ;

  transaction.measure(scope,      scope, duration, exclusive);

  transaction.measure(NAMES.WEB,   null, duration, exclusive);
  transaction.measure(NAMES.HTTP,  null, duration, exclusive);
  transaction.measure(scope,       null, duration, exclusive);

  transaction._setApdex(NAMES.APDEX + '/' + partial, duration);
  transaction._setApdex(NAMES.APDEX,                 duration);
}

module.exports = recordWeb;
