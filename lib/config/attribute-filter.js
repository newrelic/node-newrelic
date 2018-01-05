'use strict'

var NO_MATCH = 0
var EXACT_MATCH = Infinity
var DESTINATIONS = [
  'transaction_events',
  'transaction_tracer',
  'error_collector',
  'browser_monitoring'
]

module.exports = AttributeFilter

/**
 * Parses configuration for filtering attributes and provides way to test keys
 * against the configuration.
 *
 * @class
 * @private
 *
 * @param {Config} config - The configuration object for the agent.
 */
function AttributeFilter(config) {
  this.config = config
  this._rules = Object.create(null)

  var updater = this.update.bind(this)

  // Add the global rules.
  config.on('attributes.include', updater)
  config.on('attributes.exclude', updater)
  this._rules.global = Object.create(null)

  // And all the destination rules.
  DESTINATIONS.forEach(function forEachDestination(dest) {
    config.on(dest + '.attributes.include', updater)
    config.on(dest + '.attributes.exclude', updater)
    this._rules[dest] = Object.create(null)
  }, this)

  // Now pull in all the rules.
  this.update()
}

/**
 * Tests a given key against the global and destination filters.
 *
 * @param {string} destination  - The location the attribute is going to be put.
 * @param {string} key          - The name of the attribute to test.
 *
 * @return {bool} True if the key is allowed for the given destination. Otherwise
 *  false is returned.
 */
AttributeFilter.prototype.test = function test(destination, key) {
  // This method could be easilly memoized since for a given destination and key
  // the result will always be the same until a configuration update happens. A
  // given application will also have a controllable set of destinations and
  // keys to check. Think about this as a future optimization for this method.

  // First, see if attributes are even enabled for this destination.
  if (!this.config.attributes.enabled) {
    return false
  }
  if (!this.config[destination].attributes.enabled) {
    return false
  }
  var globalConfig = this._rules.global
  var destConfig = this._rules[destination]

  // Then check for exclusion of the attribute.
  var globalExclude = _matchRules(globalConfig.exclude, key)
  if (globalExclude === EXACT_MATCH) {
    return false
  }
  var destExclude = _matchRules(destConfig.exclude, key)
  if (destExclude === EXACT_MATCH) {
    return false
  }

  // Then check for inclusion of the attribute.
  var globalInclude = _matchRules(globalConfig.include, key)
  if (globalInclude === EXACT_MATCH) {
    return true
  }
  var destInclude = _matchRules(destConfig.include, key)
  if (destInclude === EXACT_MATCH) {
    return true
  }

  // Nothing has explicitly matched this key, so compare the strength of any
  // wildcard matches that may have happened.
  return (
    // If the key did not match any exclusion rule, it's in!
    (globalExclude === NO_MATCH && destExclude === NO_MATCH) ||

    // If destination include is a better match than either exclude, it's in!
    (destInclude > destExclude && destInclude >= globalExclude) ||

    // If global include is a better match than either exclude, it's in!
    (globalInclude > destExclude && globalInclude > globalExclude)
  )
}

/**
 * Updates all the rules the given filter has access to.
 */
AttributeFilter.prototype.update = function update() {
  // If `AttributeFilter#test` becomes memoized, this update function should
  // clear the cached values.

  // Update the global rules.
  this._rules.global.include = _sortRules(this.config.attributes.include)
  this._rules.global.exclude = _sortRules(this.config.attributes.exclude)

  // And all the destination rules.
  DESTINATIONS.forEach(function forEachDestination(dest) {
    this._rules[dest].include = _sortRules(this.config[dest].attributes.include)
    this._rules[dest].exclude = _sortRules(this.config[dest].attributes.exclude)
  }, this)
}

/**
 * Tests the given key against the given rule set.
 *
 * @private
 *
 * This method assumes that the rule set is sorted from best possible match to
 * least possible match. Unsorted lists may result in a lesser score being given
 * to the value.
 *
 * @param {array.<string>}  rules - The set of rules to match against.
 * @param {string}          key   - The name of the attribute to look for.
 *
 * @return {number} The strength of the match, from `0` for no-match to `Infinity`
 *  for exact matches.
 */
function _matchRules(rules, key) {
  var bestMatch = NO_MATCH
  for (var i = 0; i < rules.length && bestMatch === NO_MATCH; ++i) {
    bestMatch = Math.max(bestMatch, _checkRule(rules[i], key))
  }

  return bestMatch
}

/**
 * Determines the strength of the match between a single rule and an attribute.
 *
 * @private
 *
 * @param {string} rules  - The rule to match against.
 * @param {string} key    - The name of the attribute to compare against.
 *
 * @return {number} The strength of the match, from `0` for no-match to `Infinity`
 *  for exact matches.
 */
function _checkRule(rule, key) {
  // If the rule is not wildcard, see if it is an EXACT_MATCH!
  if (rule[rule.length - 1] !== '*') {
    return rule === key ? EXACT_MATCH : NO_MATCH
  }

  // This is a wildcard rule, see if it wants to match something longer than our
  // key. If so, then this is NO_MATCH!
  if (rule.length - 1 > key.length) {
    return NO_MATCH
  }

  // A simple prefix check wont work because the rule has a * at the end.
  // Removing that asterisk would cause a string copy, thus doubling the
  // iterations over the rule.
  for (var i = 0; i < rule.length - 1; ++i) {
    if (rule[i] !== key[i]) {
      return NO_MATCH
    }
  }

  return rule.length
}

/**
 * Sorts a set of rules by the match potential. High potential rules are sorted
 * before low potential rules.
 *
 * @private
 *
 * Sorting occurs in-place.
 *
 * @param {array.<string>} rules - The set of rules to sort.
 *
 * @return {array.<string>} The `rules` array, now sorted.
 */
function _sortRules(rules) {
  return rules.sort(function ruleSorter(a, b) {
    if (a[a.length - 1] !== '*') {
      // If `a` is an exact rule, it should be moved up.
      return -1
    } else if (b[b.length - 1] !== '*') {
      // If `b` is an exact rule and `a` is not, `b` should be moved up.
      return 1
    }

    // Both `a` and `b` are wildcard rules, so the rule with greater length
    // should be moved up.
    return b.length - a.length
  })
}
