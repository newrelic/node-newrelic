'use strict';

var path     = require('path')
  , EXTERNAL = require(path.join(__dirname, '..', '..', 'metrics', 'names')).EXTERNAL
  ;

function recordExternal(host, library) {
  if (!host) {
    throw new Error(
      "External request metrics need to be associated with a host. " +
      "Not measuring."
    );
  }

  return function (segment, scope) {
    var duration    = segment.getDurationInMillis()
      , exclusive   = segment.getExclusiveDurationInMillis()
      , transaction = segment.trace.transaction
      , metricName  = EXTERNAL.PREFIX + host + '/' + library
      , rollupType  = transaction.isWeb() ? EXTERNAL.WEB : EXTERNAL.OTHER
      , rollupHost  = EXTERNAL.PREFIX + host + '/all'
      ;

    if (scope) transaction.measure(metricName,  scope, duration, exclusive);

    transaction.measure(metricName,   null, duration, exclusive);
    transaction.measure(rollupType,   null, duration, exclusive);
    transaction.measure(rollupHost,   null, duration, exclusive);
    transaction.measure(EXTERNAL.ALL, null, duration, exclusive);
  };
}

module.exports = recordExternal;
