'use strict'

var logger = require('../logger').child({component: 'metric_normalizer'})
var deepEqual = require('../util/deep-equal')
var Rule = require('./normalizer/rule')
var NAMES = require('../metrics/names.js')


function url(normalized, path, config) {
  if (normalized) return NAMES.NORMALIZED + normalized

  if (config.enforce_backstop) {
    return NAMES.NORMALIZED + '/*'
  }

  return NAMES.URI + path
}

function plain(normalized, path) {
  if (normalized) {
    return normalized
  }

  return path
}

/**
 * The collector keeps track of rules that should be applied to metric names,
 * and sends these rules to the agent at connection time. These rules can
 * either change the name of the metric or indicate that metrics associated with
 * this name (which is generally a URL path) should be ignored altogether.
 *
 * @param {object} config The agent's configuration blob, which has a parameter
 *                        that indicates whether to enforce the normalization
 *                        backstop.
 */
function MetricNormalizer(config, type) {
  if (!config) throw new Error("normalizer must be created with configuration.")
  if (!type) throw new Error("normalizer must be created with a type.")

  this.config = config
  this.type = type
  // some mildly cheesy polymorphism to make normalizers work generically
  if (type === 'URL') {
    this.formatter = url
  } else {
    this.formatter = plain
  }

  this.rules = []
}

/**
 * Convert the raw, de-serialized JSON response into a set of
 * NormalizationRules.
 *
 * @param object json The de-serialized JSON response sent on collector
 *                    connection.
 */
MetricNormalizer.prototype.load = function load(json) {
  if (json) {
    logger.debug("Received %s %s normalization rule(s)", json.length, this.type)

    json.forEach(function cb_forEach(ruleJSON) {
      var rule = new Rule(ruleJSON)
      // no need to add the same rule twice
      var found = this.rules.some(function cb_some(r) {
        return deepEqual(r, rule)
      })

      if (!found) {
        this.rules.push(rule)
      }
    }, this)

    /* I (FLN) always forget this, so making a note: JS sort is always
     * IN-PLACE, even though it returns the sorted array.
     */
    this.rules.sort(function cb_sort(a, b) {
      return a.precedence - b.precedence
    })

    logger.debug("Normalized to %s %s normalization rule(s).",
                 this.rules.length, this.type)
  }
}

/**
 * Load any rules found in the configuration into a metric normalizer.
 *
 * Operates via side effects.
 */
MetricNormalizer.prototype.loadFromConfig = function loadFromConfig() {
  var rules = this.config.rules

  if (rules && rules.name && rules.name.length > 0) {
    rules.name.forEach(function cb_forEach(rule) {
      if (!rule.pattern) {
        return logger.error(
          {rule: rule},
          "Simple naming rules require a pattern."
        )
      }
      if (!rule.name) {
        return logger.error(
          {rule: rule},
          "Simple naming rules require a replacement name."
        )
      }

      this.addSimple(rule.pattern, rule.name)
    }, this)
  }

  if (rules && rules.ignore && rules.ignore.length > 0) {
    rules.ignore.forEach(function cb_forEach(pattern) {
      this.addSimple(pattern)
    }, this)
  }
}

/**
 * Add simple, user-provided rules to the head of the match list. These rules
 * will always be highest precedence, always will terminate matching, and
 * will always apply to the URL as a whole. If no name is provided, then
 * transactions attached to the matching URLs will be ignored.
 *
 * @param {RegExp} pattern The pattern to rename (with capture groups).
 * @param {string} name    The name to use for the transaction.
 */
MetricNormalizer.prototype.addSimple = function addSimple(pattern, name) {
  if (!pattern) return logger.error("Simple naming rules require a pattern.")

  var json = {
    match_expression: pattern,
    terminate_chain: true
  }

  if (name) {
    json.replacement = name
  } else {
    json.ignore = true
  }

  this.rules.unshift(new Rule(json))
}

/**
 * Test whether a URL path should be ignored.
 *
 * @param {string} path The URL path to test.
 *
 * @returns {boolean} Whether or not to ignore the path.
 */
MetricNormalizer.prototype.isIgnored = function isIgnored(path) {
  var length = this.rules.length
  for (var i = 0; i < length; i++) {
    var rule = this.rules[i]
    if (rule.ignore && rule.matches(path)) {
      logger.trace("Ignoring %s because of rule: %s", path, rule)
      // prevent de-optimization
      return true
    }
  }

  return false
}

/**
 * Test whether a URL path will be normalized.
 *
 * @param {string} path The URL path to test.
 *
 * @returns {boolean} Whether or not any normalization rules match.
 */
MetricNormalizer.prototype.canNormalize = function canNormalize(path) {
  var length = this.rules.length
  for (var i = 0; i < length; i++) {
    var rule = this.rules[i]
    if (!rule.ignore && rule.matches(path)) {
      logger.trace("Normalizing %s because of rule: %s", path, rule)
      // prevent de-optimization
      return true
    }
  }

  return false
}


/**
 * Turn a (scrubbed) URL path into partial metric name.
 *
 * @param {string} path The URL path to turn into a name.
 *
 * @returns {string} The normalized name.
 */
MetricNormalizer.prototype.normalize = function normalize(path) {
  var last = path
  var length = this.rules.length
  var normalized


  for (var i = 0; i < length; i++) {
    var rule = this.rules[i]
    if (rule.matches(last)) {
      normalized = rule.apply(last)
      logger.trace("Normalized %s to %s because of rule: %s", last, normalized, rule)

      if (rule.isTerminal) {
        logger.trace("Terminating normalization because of rule: %s", rule)
        break
      }

      last = normalized
    }
  }

  return this.formatter(normalized, path, this.config)
}

module.exports = MetricNormalizer
