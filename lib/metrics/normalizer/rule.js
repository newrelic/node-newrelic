'use strict'

var path   = require('path')
  , logger = require('../../logger').child({component : 'normalizer_rule'})
  

/**
 * JavaScript just has to do things slightly differently.
 */
var replaceReplacer = function replaceReplacer(input) {
  return input.replace(/\\/g, '$')
}

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
    logger.debug("Received incompletely specified " +
                 "metric normalization rule from collector.")
    json = {}
  }

  this.eachSegment   = json.each_segment                || false
  this.precedence    = json.eval_order                  || 0
  this.isTerminal    = json.terminate_chain             || false
  this.replacement   = replaceReplacer(json.replacement || '$0')
  this.replaceAll    = json.replace_all                 || false
  this.ignore        = json.ignore                      || false

  var modifiers = ''
  if (this.replaceAll) modifiers += 'g'

  // don't allow this to fail
  if (json.match_expression instanceof RegExp) {
    this.pattern = json.match_expression
  }
  else {
    try {
      this.pattern = new RegExp(json.match_expression || '^$', modifiers)
      logger.trace("Loaded normalization rule: %j", this)
    }
    catch (error) {
      logger.warn(error, "Problem compiling metric normalization rule pattern.")
      this.pattern = /^$/
    }
  }
}

/**
 * Allow the higher-level functions to operate on input uniformly.
 *
 * @param {string} input URL to potentially be split.
 */
NormalizerRule.prototype.getSegments = function getSegments(input) {
  if (this.eachSegment) {
    return input.split('/')
  }
  else {
    return [input]
  }
}

/**
 * Check if a URL matches a rule.
 *
 * @param {string} input URL to match.
 */
NormalizerRule.prototype.matches = function matches(input) {
  var segments = this.getSegments(input)

  for (var i = 0; i < segments.length; i++) {
    if (segments[i].match(this.pattern)) return true
  }

  return false
}

/**
 * Apply the substitutions, if any, to the input.
 *
 * @param {string} input URL to normalize.
 */
NormalizerRule.prototype.apply = function apply(input) {
  return this.getSegments(input)
    .map(function cb_map(segment) {
      /* String.split will return empty segments when the path has a leading
       * slash or contains a run of slashes. Don't inadvertently substitute or
       * drop these empty segments, or the normalized path will be wrong.
       */
      if (segment === "") return segment

      return segment.replace(this.pattern, this.replacement)
    }.bind(this))
    .join('/')
}

NormalizerRule.prototype.toJSON = function toJSON() {
  return {
    eachSegment : this.eachSegment,
    precedence  : this.precedence,
    isTerminal  : this.isTerminal,
    replacement : this.replacement,
    replaceAll  : this.replaceAll,
    ignore      : this.ignore,
    pattern     : this.pattern.source
  }
}

module.exports = NormalizerRule
