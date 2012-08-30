'use strict';

var path   = require('path')
  , util   = require('util')
  , logger = require(path.join(__dirname, '..', 'logger'))
  , Rule   = require(path.join(__dirname, 'normalizer', 'rule'))
  ;

function MetricNormalizer(rules) {
  if (rules) this.parseMetricRules(rules);
}

MetricNormalizer.prototype.parseMetricRules = function (connectResponse) {
  if (connectResponse.url_rules) {
    logger.debug("Received " + connectResponse.url_rules.length + " metric normalization rule(s)");

    if (!this.rules) this.rules = [];

    var self = this;
    connectResponse.url_rules.forEach(function (ruleJSON) {
      self.rules.push(new Rule(ruleJSON));
    });
  }
};

MetricNormalizer.prototype.normalizeUrl = function (url) {
  // FIXME implement
  return null;
};

module.exports = MetricNormalizer;
