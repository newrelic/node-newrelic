

function Metrics(statsEngine) {
	this.recordTransaction = function(requestUri, durationInMillis, responseStatusCode, responseStatusMessage) {
		// FIXME normalize, strip params
		if (requestUri == '/') {
			requestUri = '/ROOT';
		} else if (requestUri.charAt(requestUri.length-1) == '/') {
			requestUri = requestUri.substring(0, requestUri.length-1);
		}
		
		var frontendMetricName = "WebTransaction/Uri" + requestUri;		
		var frontendApdexMetricName = "Apdex/Uri" + requestUri;	
		statsEngine.getUnscopedStats().getStats(frontendMetricName).recordValueInMillis(durationInMillis, 0);
				
		[frontendApdexMetricName, 'Apdex'].forEach(function(name) {
			var apdexStats = statsEngine.getUnscopedStats().getApdexStats(name);
			var isError = responseStatusCode < 200 || responseStatusCode >= 400;
			if (isError) {
				apdexStats.incrementFrustrating();
			} else {
				apdexStats.recordValueInMillis(durationInMillis);
			}
		});

		statsEngine.getUnscopedStats().getStats("WebTransaction").recordValueInMillis(durationInMillis);
		statsEngine.getUnscopedStats().getStats("HttpDispatcher").recordValueInMillis(durationInMillis);
		
		return frontendMetricName;
	}
}

exports.Metrics = Metrics;
