'use strict';

var path  = require('path')
  , NAMES = require(path.join(__dirname, '..', '..', 'metrics', 'names.js'))
  ;

/*
 *
 * CONSTANTS
 *
 */
var TO_MILLIS = 1000;

function recordWeb(segment, scope) {
  // in web metrics, scope is required
  if (!scope) return;

  var duration         = segment.getDurationInMillis()
    , exclusive        = segment.getExclusiveDurationInMillis()
    , transaction      = segment.trace.transaction
    , partial          = segment.partialName
    , config           = segment.trace.transaction.agent.config
    // named / key transaction support requires per-name apdexT
    , keyApdexInMillis = config.web_transactions_apdex[scope] * TO_MILLIS
    ;

  transaction.measure(scope,      scope, duration, exclusive);

  transaction.measure(NAMES.WEB,   null, duration, exclusive);
  transaction.measure(NAMES.HTTP,  null, duration, exclusive);
  transaction.measure(scope,       null, duration, exclusive);

  transaction._setApdex(NAMES.APDEX + '/' + partial, duration, keyApdexInMillis);
  transaction._setApdex(NAMES.APDEX,                 duration, null);
}

module.exports = recordWeb;
