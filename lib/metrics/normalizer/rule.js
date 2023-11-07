/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../../logger').child({ component: 'normalizer_rule' })

/**
 * JavaScript just has to do things slightly differently.
 *
 * @param input
 */
const replaceReplacer = function replaceReplacer(input) {
  return input.replace(/\\/g, '$')
}

/**
 * Be liberal about accepting incomplete information, because we don't want
 * bad rules from the collector to crash client apps. Otherwise, this is a
 * fairly straightforward mapping of the concepts in metric normalization
 * rules into an object form.
 *
 * @param {object} json A JavaScript object literal parsed out from the JSON
 *                      from the collector.
 */
function NormalizerRule(json) {
  if (!json) {
    logger.debug('Received incompletely specified metric normalization rule from collector.')
    json = Object.create(null)
  }

  this.eachSegment = json.each_segment || false
  this.precedence = json.eval_order || 0
  this.isTerminal = json.terminate_chain || false
  this.replacement = replaceReplacer(json.replacement || '$0')
  this.replaceAll = json.replace_all || false
  this.ignore = json.ignore || false
  this.matched = false

  let modifiers = 'i'
  if (this.replaceAll) {
    modifiers += 'g'
  }

  // don't allow this to fail
  if (json.match_expression instanceof RegExp) {
    this.pattern = _addRegExpFlags(json.match_expression, modifiers)
  } else {
    try {
      this.pattern = new RegExp(json.match_expression || '^$', modifiers)
    } catch (error) {
      logger.warn(error, 'Problem compiling metric normalization rule pattern.')
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

  return [input]
}

/**
 * Check if a URL matches a rule.
 *
 * Does not set {NormalizerRule#matched}.
 *
 * @param {string} input - URL to match.
 * @returns {boolean} - True if this rule matches the given input, otherwise false.
 */
NormalizerRule.prototype.matches = function matches(input) {
  const segments = this.getSegments(input)

  for (let i = 0; i < segments.length; ++i) {
    if (this.pattern.test(segments[i])) {
      return true
    }
  }

  return false
}

/**
 * Apply the substitutions, if any, to the input.
 *
 * Also sets {NormalizerRule#matched} to true if this rule did match the given
 * input.
 *
 * String.split will return empty segments when the path has a leading slash or
 * contains a run of slashes. Don't inadvertently substitute or drop these empty
 * segments, or the normalized path will be wrong.
 *
 * XXX In Node v0.8 and Node v0.10, `RegExp#test` advances internal state and
 * XXX tracks where it left off from the previous match. This has the side
 * XXX effect that reusing the same object may cause false negatives if you do
 * XXX not reset that state. The only way to reset the state is to set
 * XXX `RegExp#lastIndex` to `0`.
 *
 * @param {string} input - URL to normalize.
 * @returns {string?} - The normalized url, or `null` if this is an ignore rule
 *  that matched this url.
 */
NormalizerRule.prototype.apply = function apply(input) {
  // For ignore rules, just see if we match and return either `null` or the
  // original input.
  if (this.ignore) {
    return (this.matched = this.matches(input)) ? null : input
  }

  this.matched = false
  const result = this.getSegments(input)
    .map(function applyMap(segment) {
      // Discussion of why we use `lastIndex` in function documentation to
      // prevent de-opt due to long function.
      this.pattern.lastIndex = 0
      if (segment && this.pattern.test(segment)) {
        this.matched = true
        return segment.replace(this.pattern, this.replacement)
      }
      return segment
    }, this)
    .join('/')
  return input[0] === '/' && result[0] !== '/' ? '/' + result : result
}

NormalizerRule.prototype.toJSON = function toJSON() {
  return {
    eachSegment: this.eachSegment,
    precedence: this.precedence,
    isTerminal: this.isTerminal,
    replacement: this.replacement,
    replaceAll: this.replaceAll,
    ignore: this.ignore,
    pattern: this.pattern.source
  }
}

/**
 * Merges the given flags with those already in a regular expression.
 *
 * @param {RegExp} re     - The regular expression to add flags to.
 * @param {string} flags  - The flags to add to the regex.
 * @returns {RegExp} - A regular expression with all the given flags added.
 */
function _addRegExpFlags(re, flags) {
  let foundMissing = false
  let reFlags = re.flags
  for (let i = 0; i < flags.length; ++i) {
    if (reFlags.indexOf(flags[i]) === -1) {
      foundMissing = true
      reFlags += flags[i]
    }
  }
  return foundMissing ? new RegExp(re.source, reFlags) : re
}

module.exports = NormalizerRule
