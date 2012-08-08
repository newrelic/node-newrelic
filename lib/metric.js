'use strict';

var path = require('path')
  , logger = require(path.join(__dirname, 'logger'))
  ;

exports.externalMetrics = function (host, library, operation) {
  return function (tracer, unscopedStats, scopedStats) {
    var duration = tracer.getDurationInMillis();

    logger.verbose('adding ' + duration + 's event to External/all (unscoped)');
    unscopedStats.byName("External/all").recordValueInMillis(duration);

    var rollupName = 'External/all';
    if (tracer.getTransaction().isWebTransaction()) {
      rollupName = rollupName + '/Web';
    }
    else {
      rollupName = rollupName + '/Other';
    }
    logger.verbose('adding ' + duration + 's event to ' + rollupName + ' (unscoped)');
    unscopedStats.byName(rollupName).recordValueInMillis(duration);

    logger.verbose('adding ' + duration + 's event to External/' + host + '/all (unscoped)');
    unscopedStats.byName("External/" + host + "/all").recordValueInMillis(duration);

    var metricName = "External/" + host + '/' + library;
    logger.verbose('adding ' + duration + 's event to ' + metricName + ' (unscoped)');
    unscopedStats.byName(metricName).recordValueInMillis(duration);

    logger.verbose('adding ' + duration + 's event to ' + metricName + ' (scoped)');
    scopedStats.byName(metricName).recordValueInMillis(duration);
  };
};

exports.recordWebTransactionMetrics = function (metricNormalizer,
                                                unscopedStats,
                                                requestUri,
                                                durationInMillis,
                                                totalExclusiveInMillis,
                                                responseStatusCode) {
  var isError = responseStatusCode < 200 || responseStatusCode >= 400;
  // FIXME normalize, strip params

  var partialName;
  if (responseStatusCode === 414 || // Request-URI Too Long
      (responseStatusCode >= 400 && responseStatusCode < 405)) {
    partialName = 'StatusCode/' + responseStatusCode;
  }
  else {
    if (requestUri === '/') {
      requestUri = '/ROOT';
    }
    else if (requestUri.charAt(requestUri.length-1) === '/') {
      requestUri = requestUri.substring(0, requestUri.length-1);
    }

    var normalizedUrl = metricNormalizer.normalizeUrl(requestUri);
    if (normalizedUrl) {
      partialName = 'NormalizedUri' + normalizedUrl;
    }
    else {
      partialName = 'Uri' + requestUri;
    }
  }

  var frontendMetricName = "WebTransaction/" + partialName;
  var maxDuration = Math.max(0, durationInMillis - totalExclusiveInMillis);

  unscopedStats.byName(frontendMetricName).recordValueInMillis(durationInMillis, maxDuration);

  var frontendApdexMetricName = "Apdex/" + partialName;
  [frontendApdexMetricName, 'Apdex'].forEach(function (name) {
    var apdexStats = unscopedStats.getApdexStats(name);
    if (isError) {
      apdexStats.incrementFrustrating();
    }
    else {
      apdexStats.recordValueInMillis(durationInMillis);
    }
  });

  unscopedStats.byName("WebTransaction").recordValueInMillis(durationInMillis);
  unscopedStats.byName("HttpDispatcher").recordValueInMillis(durationInMillis);

  return frontendMetricName;
};
