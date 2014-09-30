'use strict';

var EXTERNAL = require('../../metrics/names').EXTERNAL
  ;

function recordExternal(host, library) {
  if (!host) {
    throw new Error(
      'External request metrics need to be associated with a host. ' +
      'Not measuring.'
    );
  }

  return function cls_recordExternal(segment, scope) {
    var duration    = segment.getDurationInMillis()
      , exclusive   = segment.getExclusiveDurationInMillis()
      , transaction = segment.trace.transaction
      , metricName  = EXTERNAL.PREFIX + host + '/' + library
      , rollupType  = transaction.isWeb() ? EXTERNAL.WEB : EXTERNAL.OTHER
      , rollupHost  = EXTERNAL.PREFIX + host + '/all'
      ;

    // TODO: cat-test similar to http.js in this folder, check
    // on(transactionFinished) after making an http server that does a call out
    // to a different instrumented server. Wraithan is claiming these tests but
    // marking them so he knows to do them.
    if (segment.catId && segment.catTransaction) {
      transaction.measure(
        EXTERNAL.APP + host + '/' + segment.catId + '/all',
        null,
        duration,
        exclusive
      );

      transaction.measure(
        EXTERNAL.TRANSACTION + host + '/' + segment.catId + '/' + segment.catTransaction,
        null,
        duration,
        exclusive
      );

      // This CAT metric replaces scoped External/{host}/{method}
      if (scope) {
        transaction.measure(
          EXTERNAL.TRANSACTION + host + '/' + segment.catId + '/' + segment.catTransaction,
          scope,
          duration,
          exclusive
        );
      }
    } else {
      if (scope) transaction.measure(metricName,  scope, duration, exclusive);
    }

    transaction.measure(metricName,   null, duration, exclusive);
    transaction.measure(rollupType,   null, duration, exclusive);
    transaction.measure(rollupHost,   null, duration, exclusive);
    transaction.measure(EXTERNAL.ALL, null, duration, exclusive);

  };
}

module.exports = recordExternal;
