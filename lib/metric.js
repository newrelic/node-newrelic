
exports.externalMetrics = function(host, library, operation) {
    return function(tracer, unscopedStats, scopedStats) {
    	var duration = tracer.getDurationInMillis();
        unscopedStats.getStats("External/all").recordValueInMillis(duration);
        unscopedStats.getStats("External/all" + (tracer.getTransaction().isWebTransaction() ? "Web" : "Other")).
                recordValueInMillis(duration);

        unscopedStats.getStats("External/" + host + "/all").recordValueInMillis(duration);
        
        var metricName = "External/" + host + '/' + library;
        unscopedStats.getStats(metricName).recordValueInMillis(duration);
        scopedStats.getStats(metricName).recordValueInMillis(duration);        
    };
};

exports.recordWebTransactionMetrics = function(metricNormalizer, unscopedStats, requestUri, durationInMillis, responseStatusCode) {
    var isError = responseStatusCode < 200 || responseStatusCode >= 400;
    // FIXME normalize, strip params
    var partialName;
    if (responseStatusCode == 414 || // Request-URI Too Long
            (responseStatusCode >= 400 && responseStatusCode < 405)) {
        partialName = 'StatusCode/' + responseStatusCode;
    } else {
        if (requestUri == '/') {
            requestUri = '/ROOT';
        } else if (requestUri.charAt(requestUri.length-1) == '/') {
            requestUri = requestUri.substring(0, requestUri.length-1);
        }
        var normalizedUrl = metricNormalizer.normalizeUrl(requestUri);
        if (normalizedUrl) {
            partialName = 'NormalizedUri' + normalizedUrl;
        } else {
            partialName = 'Uri' + requestUri;
        }
    }
    var frontendMetricName = "WebTransaction/" + partialName;
    var frontendApdexMetricName = "Apdex/" + partialName;    
    unscopedStats.getStats(frontendMetricName).recordValueInMillis(durationInMillis, 0);
                
    [frontendApdexMetricName, 'Apdex'].forEach(function(name) {
        var apdexStats = unscopedStats.getApdexStats(name);
        if (isError) {
            apdexStats.incrementFrustrating();
        } else {
            apdexStats.recordValueInMillis(durationInMillis);
        }
    });

    unscopedStats.getStats("WebTransaction").recordValueInMillis(durationInMillis);
    unscopedStats.getStats("HttpDispatcher").recordValueInMillis(durationInMillis);
        
    return frontendMetricName;
};

function MetricNormalizer(logger) {
    this.parseMetricRules = function(connectResponse) {
        var rules = connectResponse['url_rules'];
        if (rules) {
            logger.debug("Received " + rules.length + " metric naming rules");
        }
    };
    
    this.normalizeUrl = function(url) {
        // FIXME implement
        return null;
    };
}

exports.MetricNormalizer = MetricNormalizer;