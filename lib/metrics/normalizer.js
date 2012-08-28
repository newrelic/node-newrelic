'use strict';

var path   = require('path')
  , logger = require(path.join(__dirname, '..', 'logger'))
  ;

function MetricNormalizer(rules) {
  this.rules = rules;
}

MetricNormalizer.prototype.parseMetricRules = function (connectResponse) {
  // TODO: this should probably be doing more than just (optionally) logging the rules
  this.rules = connectResponse.url_rules;
  if (this.rules) logger.debug("Received " + this.rules.length + " metric naming rule(s)");
};

MetricNormalizer.prototype.normalizeUrl = function (url) {
  // FIXME implement
  return null;
};

module.exports = MetricNormalizer;
