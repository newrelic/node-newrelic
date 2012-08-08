'use strict';

function MetricNormalizer(logger) {
  this.logger = logger;
}

MetricNormalizer.prototype.parseMetricRules = function (connectResponse) {
  // TODO: this should probably be doing more than just (optionally) logging the rules
  this.rules = connectResponse.url_rules;
  if (this.rules) this.logger.debug("Received " + this.rules.length + " metric naming rule(s)");
};

MetricNormalizer.prototype.normalizeUrl = function (url) {
  // FIXME implement
  return null;
};

module.exports = MetricNormalizer;
