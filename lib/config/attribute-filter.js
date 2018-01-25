'use strict'

var array = require('../util/arrays')


var NO_MATCH = 0
var EXACT_MATCH = Infinity
var DESTINATIONS = {
  TRANS_EVENT: 0x01,
  TRANS_TRACE: 0x02,
  ERROR_EVENT: 0x04,
  BROWSER_EVENT: 0x08
}
var DESTINATION_NAMES = [
  'transaction_events',
  'transaction_tracer',
  'error_collector',
  'browser_monitoring'
]
var DESTINATION_MAP = {
  0x01: 'transaction_events',
  0x02: 'transaction_tracer',
  0x04: 'error_collector',
  0x08: 'browser_monitoring'
}

module.exports = exports = AttributeFilter
exports.DESTINATIONS = DESTINATIONS

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
  this._cache = Object.create(null)
  this._cachedCount = 0

  var updater = this.update.bind(this)

  // Add the global rules.
  config.on('attributes.include', updater)
  config.on('attributes.exclude', updater)
  this._rules.global = Object.create(null)

  // And all the destination rules.
  DESTINATION_NAMES.forEach(function forEachDestination(dest) {
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
 * @param {DESTINATIONS} destination  - The location the attribute is going to be put.
 * @param {string} key                - The name of the attribute to test.
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
  var destStr = DESTINATION_MAP[destination]
  if (!this.config[destStr].attributes.enabled) {
    return false
  }

  // Next see if the result is cached.
  var cached = this._cache[destStr][key]
  if (cached !== undefined) {
    return cached
  }

  // Result isn't cached, so compare and then test it.
  var result = _doTest(this._rules.global, this._rules[destStr], key)
  if (this._cachedCount < this.config.attributes.filter_cache_limit) {
    this._cache[destStr][key] = result
    ++this._cachedCount
  }

  return result
}

/**
 * Updates all the rules the given filter has access to.
 */
AttributeFilter.prototype.update = function update() {
  // If `AttributeFilter#test` becomes memoized, this update function should
  // clear the cached values.

  // Update the global rules.
  this._rules.global.include = _importRules(this.config.attributes.include)
  this._rules.global.exclude = _importRules(this.config.attributes.exclude)
  this._cache = Object.create(null)
  this._cachedCount = 0

  // And all the destination rules.
  DESTINATION_NAMES.forEach(function forEachDestination(dest) {
    this._rules[dest].include = _importRules(this.config[dest].attributes.include)
    this._rules[dest].exclude = _importRules(this.config[dest].attributes.exclude)
    this._cache[dest] = Object.create(null)
  }, this)
}

function _doTest(globalConfig, destConfig, key) {
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
  if (rules.exact && rules.exact.test(key)) {
    return EXACT_MATCH
  }

  var wildcard = rules.wildcard
  if (!wildcard) {
    return NO_MATCH
  }

  wildcard.lastIndex = 0
  wildcard.test(key)
  return wildcard.lastIndex
}

/**
 * Converts the raw rules into a set of regular expressions to test against.
 *
 * @private
 *
 * @param {array.<string>} rules - The set of rules to compose.
 *
 * @return {object} An object with `exact` and `wildcard` properties which are
 * `RegExp` instances for testing keys.
 */
function _importRules(rules) {
  var out = {
    exact: null,
    wildcard: null
  }
  var exactRules = []
  var wildcardRules = []
  rules.forEach(function separateRules(rule) {
    if (rule[rule.length - 1] === '*') {
      wildcardRules.push(rule)
    } else {
      exactRules.push(rule)
    }
  })

  if (exactRules.length) {
    out.exact = new RegExp('^' + _convertRulesToRegex(exactRules) + '$')
  }
  if (wildcardRules.length) {
    // The 'g' option is what makes the RegExp set `lastIndex` which we use to
    // test the strength of the match.
    out.wildcard = new RegExp('^' + _convertRulesToRegex(wildcardRules), 'g')
  }
  return out
}

/**
 * Converts an array of attribute rules into a regular expression string.
 *
 * @private
 *
 * `["foo.bar", "foo.bang"]` becomes "(?:foo\.(?:bar|bang))"
 *
 * @param {array.<string>} rules - The set of rules compose into a regex.
 *
 * @return {string} The rules composed into a single regular expression string.
 */
function _convertRulesToRegex(rules) {
  return '(?:' + rules.sort(function ruleSorter(a, b) {
    // Step 1) Sort the rules according to match-ability. This way the regex
    // will test the rules with the highest possible strength before weaker rules.

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
  }).map(function ruleSplitter(rule) {
    // Step 2) Escape regex special characters and split the rules into arrays.

    // 'foo.bar' => ['foo', 'bar']
    // 'foo.bang*' => ['foo', 'bang\\*']
    // 'fizz.bang' => ['fizz', 'bang']
    return rule.replace(/([.*+?|\\^$()\[\]])/g, function cleaner(m) {
      return '\\' + m
    }).split('.')
  }).reduce(function ruleTransformer(collection, ruleParts) {
    // Step 3) Merge the split rules into a single nested array, deduplicating
    // rule sections as we go.

    // ['foo', 'bar'] => [['foo\\.', ['bar']]]
    // ['foo', 'bang\\*'] => [['foo\\.', ['bar'], ['bang']]]
    // ['fizz', 'bang'] => [['foo\\.', ['bar'], ['bang']], ['fizz\\.', ['bang']]]
    add(collection, ruleParts, 0)
    return collection
    function add(c, r, i) {
      var v = r[i]
      if (i !== r.length - 1) {
        v += '.'
      } else if (/\\\*$/.test(v)) {
        v = v.substr(0, v.length - 2)
      }

      var idx = array.findIndex(c, function findV(a) {
        return a[0] === v
      })
      var part = c[idx]

      if (idx === -1) {
        part = [v]
        c.push(part)
      }
      if (i !== r.length - 1) {
        add(part, r, i + 1)
      }
    }
  }, []).map(function rulesToRegex(part) {
    // Step 4) Merge each of the transformed rules into a regex.

    // ['foo\\.', ['bar', 'bang']] => 'foo\\.(?:bar|bang)'
    // ['fizz\\.', ['bang']] => 'fizz\\.(?:bang)'
    return mapper(part)
    function mapper(p) {
      if (typeof p === 'string') {
        return p
      } else if (p.length === 1) {
        return mapper(p[0])
      }
      var first = mapper(p.shift()) // shift === pop_front
      return first + '(?:' + p.map(mapper).join('|') + ')'
    }
  }).join('|') + ')' // Step 5) Merge all the regex strings into one.
}
