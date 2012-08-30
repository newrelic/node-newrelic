'use strict';

var path = require('path')
  , logger = require(path.join(__dirname, '..', '..', 'logger'))
  ;

/**
 * JavaScript just has to do things slightly differently.
 */
var replaceReplacer = function replaceReplacer(input) {
  return input.replace(/\\/g, '$');
};

/**
 * Be liberal about accepting incomplete information, because we don't want
 * bad rules from the collector to crash client apps. Otherwise, this is a
 * fairly straightforward mapping of the concepts in metric normalization
 * rules into an object form.
 *
 * @param {Object} json A JavaScript object literal parsed out from the JSON
 *                      from the collector.
 */
function NormalizerRule(json) {
  if (!json) {
    logger.verbose("Received incompletely specified metric normalization rule from collector.");
    json = {};
  }

  this.eachSegment   = json.each_segment                || false;
  this.precedence    = json.eval_order                  || 0;
  this.isTerminal    = json.terminate_chain             || false;
  this.patternString = json.match_expression            || '^$';
  this.replacement   = replaceReplacer(json.replacement || '$0');
  this.replaceAll    = json.replace_all                 || false;
  this.ignore        = json.ignore                      || false;

  // don't allow this to fail
  try {
    this.pattern = new RegExp(this.patternString);
    logger.verbose("Parsed URL normalization rule with pattern " + this.pattern);
  }
  catch (error) {
    logger.debug("When compiling metric normalization rule pattern, got error:");
    logger.debug(error);
    // come up with a default that preserves idempotency
    this.pattern = /^$/;
  }
}

/**
 * Allow the higher-level functions to operate on input uniformly.
 *
 * @param {string} input URL to potentially be split.
 */
NormalizerRule.prototype.getSegments = function getSegments(input) {
  if (this.eachSegment) {
    return input.split('/');
  }
  else {
    return [input];
  }
};

/**
 * Check if a URL matches a rule.
 *
 * @param {string} input URL to match.
 */
NormalizerRule.prototype.matches = function (input) {
  var segments = this.getSegments(input);

  for (var i = 0; i < segments.length; i++) {
    if (segments[i].match(this.pattern)) return true;
  }

  return false;
};

/**
 * Apply the substitutions, if any, to the input.
 *
 * @param {string} input URL to normalize.
 */
NormalizerRule.prototype.apply = function (input) {
  var self = this;
  return this.getSegments(input)
    .map(function (segment) {
      return segment.replace(self.pattern, self.replacement);
    })
    .join('/');
};

module.exports = NormalizerRule;
