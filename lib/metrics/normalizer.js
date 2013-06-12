'use strict';

var path      = require('path')
  , logger    = require(path.join(__dirname, '..', 'logger'))
                  .child({component : 'metric_normalizer'})
  , deepEqual = require(path.join(__dirname, '..', 'util', 'deep-equal'))
  , Rule      = require(path.join(__dirname, 'normalizer', 'rule'))
  ;

/**
 * The collector keeps track of rules that should be applied to metric names,
 * and sends these rules to the agent at connection time. These rules can
 * either change the name of the metric or indicate that metrics associated with
 * this name (which is generally a URL path) should be ignored altogether.
 */
function MetricNormalizer(json) {
  if (json) this.load(json);
}

/**
 * Convert the raw, deserialized JSON response into a set of
 * NormalizationRules.
 *
 * FIXME: dedupe the rule list after sorting.
 *
 * @param object json The deserialized JSON response sent on collector
 *                    connection.
 */
MetricNormalizer.prototype.load = function (json) {
  if (json && json.url_rules) {
    var raw = json.url_rules;
    logger.debug("Received %d metric normalization rule(s)", raw.length);

    if (!this.rules) this.rules = [];

    raw.forEach(function (json) {
      var rule = new Rule(json);
      // no need to add the same rule twice
      if (!this.rules.some(function (r) { return deepEqual(r, rule); })) {
        this.rules.push(rule);
      }
    }.bind(this));

    /* I (FLN) always forget this, so making a note: JS sort is always
     * IN-PLACE, even though it returns the sorted array.
     */
    this.rules.sort(function (a, b) { return a.precedence - b.precedence; });

    logger.debug("Normalized to %s metric normalization rule(s).", this.rules.length);
  }
};

/**
 * Returns an object with these properties:
 *
 * 1. name: the raw name
 * 2. normalized: the normalized name (if applicable)
 * 3. ignore: present and true if the matched rule says to ignore matching names
 * 4. terminal: present and true if the matched rule terminated evaluation
 */
MetricNormalizer.prototype.normalize = function (name) {
  var result = {name : name};

  if (!this.rules || this.rules.length === 0) return result;

  var last = name;

  for (var i = 0; i < this.rules.length; i++) {
    var rule = this.rules[i];
    if (rule.matches(last)) {
      result.normalized = rule.apply(last);

      if (rule.ignore) {
        result.ignore = true;
        delete result.normalized;
        logger.trace("Ignoring %s because of rule: %j", name, rule);
        break;
      }

      logger.trace("Normalized %s to %s because of rule: %j", last,
                   result.normalized, rule);

      if (rule.isTerminal) {
        result.terminal = true;
        logger.trace("Terminating normalization because of rule: %j", rule);
        break;
      }

      last = result.normalized;
    }
  }

  return result;
};

module.exports = MetricNormalizer;
