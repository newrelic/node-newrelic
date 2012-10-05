'use strict';

var path   = require('path')
  , util   = require('util')
  , logger = require(path.join(__dirname, '..', 'logger')).child({component : 'metric_normalizer'})
  , Rule   = require(path.join(__dirname, 'normalizer', 'rule'))
  ;

function MetricNormalizer(rules) {
  if (rules) this.parseMetricRules(rules);
}

MetricNormalizer.prototype.parseMetricRules = function (connectResponse) {
  if (connectResponse && connectResponse.url_rules) {
    logger.debug("Received %d metric normalization rule(s)",
                 connectResponse.url_rules.length);

    if (!this.rules) this.rules = [];

    connectResponse.url_rules.forEach(function (ruleJSON) {
      this.rules.push(new Rule(ruleJSON));
    }.bind(this));

    // I (FLN) always forget this, so making a note:
    // JS sort is always IN-PLACE.
    this.rules.sort(function (a, b) {
      return a.precedence - b.precedence;
    });
  }
};

MetricNormalizer.prototype.normalizeUrl = function (url) {
  if (!this.rules) return null;

  var normalized = url;
  var isNormalized = false;

  for (var i = 0; i < this.rules.length; i++) {
    if (this.rules[i].matches(normalized)) {
      /*
       * It's possible for normalization rules to match without transforming.
       *
       * Don't assume that it's required for the URL to actually change
       * for normalization to have taken place.
       */
      isNormalized = true;
      normalized = this.rules[i].apply(normalized);
      // assume that terminate_chain only applies upon match
      if (this.rules[i].isTerminal) break;
    }
  }

  if (!isNormalized) return null;

  return normalized;
};

module.exports = MetricNormalizer;
