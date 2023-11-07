/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const EventEmitter = require('events').EventEmitter
const util = require('util')
const logger = require('../logger').child({ component: 'metric_normalizer' })
const deepEqual = require('../util/deep-equal')
const NormalizerRule = require('./normalizer/rule')
const NAMES = require('../metrics/names.js')

function url(normalized, path, config) {
  if (normalized) {
    return NAMES.NORMALIZED + normalized
  }

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
 * @param type
 */
function MetricNormalizer(config, type) {
  if (!config) {
    throw new Error('normalizer must be created with configuration.')
  }
  if (!type) {
    throw new Error('normalizer must be created with a type.')
  }

  EventEmitter.call(this)

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
util.inherits(MetricNormalizer, EventEmitter)

// -------------------------------------------------------------------------- //

/**
 * @typedef {object} NormalizationResults
 * @property {boolean}   matched - True if a rule was found that matched.
 * @property {boolean}   ignore  - True if the given input should be ignored.
 * @property {string} value   - The normalized input value.
 */

// -------------------------------------------------------------------------- //

/**
 * Convert the raw, de-serialized JSON response into a set of
 * NormalizationRules.
 *
 * @param object json The de-serialized JSON response sent on collector
 *                    connection.
 * @param json
 */
MetricNormalizer.prototype.load = function load(json) {
  if (json) {
    this.rules = []
    logger.debug('Received %s %s normalization rule(s) from the server', json.length, this.type)

    json.forEach((ruleJSON) => {
      // no need to add the same rule twice
      const rule = new NormalizerRule(ruleJSON)
      if (!this.rules.find(deepEqual.bind(null, rule))) {
        this.rules.push(rule)
        logger.trace('Loaded %s normalization rule: %s', this.type, rule)
      }
    })

    /* I (FLN) always forget this, so making a note: JS sort is always
     * IN-PLACE, even though it returns the sorted array.
     */
    this.rules.sort((a, b) => {
      return a.precedence - b.precedence
    })

    logger.debug('Loaded %s %s normalization rule(s).', this.rules.length, this.type)
  }
}

/**
 *  Helper for loadFromConfig
 *
 * @param rule {object} from this.config.rules
 * @param ctx {object} context from the calling function
 */
function processNameRule(rule, ctx) {
  if (!rule.pattern) {
    return logger.error({ rule: rule }, 'Simple naming rules require a pattern.')
  }
  if (!rule.name) {
    return logger.error({ rule: rule }, 'Simple naming rules require a replacement name.')
  }

  const precedence = rule.precedence
  const terminal = rule.terminate_chain
  const json = {
    match_expression: rule.pattern,
    eval_order: typeof precedence === 'number' ? precedence : 500,
    terminate_chain: typeof terminal === 'boolean' ? terminal : true,
    replace_all: rule.replace_all,
    replacement: rule.name,
    ignore: false
  }

  // Find where the rule should be inserted and do so.
  const reverse = ctx.config.feature_flag.reverse_naming_rules
  const insert = ctx.rules.findIndex(function findRule(r) {
    return reverse ? r.precedence >= json.eval_order : r.precedence > json.eval_order
  })
  if (insert === -1) {
    ctx.rules.push(new NormalizerRule(json))
  } else {
    ctx.rules.splice(insert, 0, new NormalizerRule(json))
  }
}
/**
 * Load any rules found in the configuration into a metric normalizer.
 *
 * Operates via side effects.
 */
MetricNormalizer.prototype.loadFromConfig = function loadFromConfig() {
  const ctx = this
  const rules = this.config.rules

  if (rules && rules.name && rules.name.length > 0) {
    rules.name.forEach((name) => processNameRule(name, ctx))
  }

  if (rules && rules.ignore && rules.ignore.length > 0) {
    rules.ignore.forEach((pattern) => {
      this.addSimple(pattern)
    })
  }
}

/**
 * Add simple, user-provided rules to the head of the match list. These rules
 * will always be highest precedence, always will terminate matching, and
 * will always apply to the URL as a whole. If no name is provided, then
 * transactions attached to the matching URLs will be ignored.
 *
 *  - `addSimple(opts)`
 *  - `addSimple(pattern [, name])`
 *
 * @param {RegExp} pattern The pattern to rename (with capture groups).
 * @param {string} [name]  The name to use for the transaction.
 */
MetricNormalizer.prototype.addSimple = function addSimple(pattern, name) {
  if (!pattern) {
    return logger.error('Simple naming rules require a pattern.')
  }

  const json = {
    match_expression: pattern,
    eval_order: 0,
    terminate_chain: true,
    replace_all: false,
    replacement: null,
    ignore: false
  }

  if (name) {
    json.replacement = name
  } else {
    json.ignore = true
  }

  this.rules.unshift(new NormalizerRule(json))
}

/**
 * Turn a (scrubbed) URL path into partial metric name.
 *
 * @param {string} path - The URL path to turn into a name.
 * @returns {NormalizationResults} - The results of normalization.
 */
MetricNormalizer.prototype.normalize = function normalize(path) {
  let last = path
  const length = this.rules.length
  let normalized
  let matched = false
  let ignored = false

  // Apply each of our rules in turn.
  for (let i = 0; i < length; i++) {
    const rule = this.rules[i]
    const applied = rule.apply(last)
    if (!rule.matched) {
      continue
    }

    if (rule.ignore) {
      ignored = true
    } else {
      matched = true
      normalized = applied

      // emit event when a rule is matched
      // we could also include an array of matched rules in the returned map, but
      // that would increase memory overhead by creating additional array
      this.emit('appliedRule', rule, normalized, last)

      logger.trace({ rule: rule, type: this.type }, 'Normalized %s to %s.', last, normalized)
      last = normalized
    }

    if (rule.isTerminal) {
      logger.trace({ rule: rule }, 'Terminating normalization.')
      break
    }
  }

  // Return the normalized path.
  return {
    matched: matched,
    ignore: ignored,
    value: this.formatter(normalized, path, this.config)
  }
}

module.exports = MetricNormalizer
