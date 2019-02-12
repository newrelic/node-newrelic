'use strict'

var NO_MATCH = -Infinity
var EXACT_MATCH = Infinity
var DESTINATIONS = {
  NONE: 0x00,
  TRANS_EVENT: 0x01,
  TRANS_TRACE: 0x02,
  ERROR_EVENT: 0x04,
  BROWSER_EVENT: 0x08,
  SPAN_EVENT: 0x10,
  TRANS_SEGMENT: 0x20
}
DESTINATIONS.TRANS_SCOPE =
  DESTINATIONS.TRANS_EVENT |
  DESTINATIONS.TRANS_TRACE |
  DESTINATIONS.ERROR_EVENT |
  DESTINATIONS.BROWSER_EVENT

DESTINATIONS.SEGMENT_SCOPE = DESTINATIONS.SPAN_EVENT | DESTINATIONS.TRANS_SEGMENT

DESTINATIONS.TRANS_COMMON =
  DESTINATIONS.TRANS_EVENT |
  DESTINATIONS.TRANS_TRACE |
  DESTINATIONS.ERROR_EVENT

DESTINATIONS.LIMITED = DESTINATIONS.TRANS_TRACE | DESTINATIONS.ERROR_EVENT

const TRANS_SCOPE_DETAILS = [
  {id: DESTINATIONS.TRANS_EVENT, key: 'TRANS_EVENT', name: 'transaction_events'},
  {id: DESTINATIONS.TRANS_TRACE, key: 'TRANS_TRACE', name: 'transaction_tracer'},
  {id: DESTINATIONS.ERROR_EVENT, key: 'ERROR_EVENT', name: 'error_collector'},
  {id: DESTINATIONS.BROWSER_EVENT, key: 'BROWSER_EVENT', name: 'browser_monitoring'}
]

const SEGMENT_SCOPE_DETAILS = [
  {id: DESTINATIONS.SPAN_EVENT, key: 'SPAN_EVENT', name: 'span_events'},
  {id: DESTINATIONS.TRANS_SEGMENT, key: 'TRANS_SEGMENT', name: 'transaction_segments'}
]

const DESTINATION_DETAILS = [...TRANS_SCOPE_DETAILS, ...SEGMENT_SCOPE_DETAILS]

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
  this._enabledDestinations = DESTINATIONS.NONE

  var updater = this.update.bind(this)

  // Add the global rules.
  config.on('attributes.enabled', updater)
  config.on('attributes.include', updater)
  config.on('attributes.exclude', updater)
  this._rules.global = Object.create(null)

  // And all the destination rules.
  DESTINATION_DETAILS.forEach(function forEachDestination(dest) {
    config.on(dest.name + '.attributes.enabled', updater)
    config.on(dest.name + '.attributes.include', updater)
    config.on(dest.name + '.attributes.exclude', updater)
    this._rules[dest.name] = Object.create(null)
  }, this)

  // Now pull in all the rules.
  this.update()
}

/**
 * Tests a given key against the global and destination transaction filters.
 *
 * @param {DESTINATIONS}  destinations  - The locations the attribute wants to be put.
 * @param {string}        key           - The name of the attribute to test.
 *
 * @return {DESTINATIONS} The destinations the attribute should be put.
 */
AttributeFilter.prototype.filterTransaction = filterTransaction
function filterTransaction(destinations, key) {
  return this._filter(TRANS_SCOPE_DETAILS, destinations, key)
}

/**
 * Tests a given key against the global and destination segment filters.
 *
 * @param {DESTINATIONS}  destinations  - The locations the attribute wants to be put.
 * @param {string}        key           - The name of the attribute to test.
 *
 * @return {DESTINATIONS} The destinations the attribute should be put.
 */
AttributeFilter.prototype.filterSegment = function filterSegment(destinations, key) {
  return this._filter(SEGMENT_SCOPE_DETAILS, destinations, key)
}

/**
 * Tests a given key against all global and destination filters.
 *
 * @param {DESTINATIONS}  destinations  - The locations the attribute wants to be put.
 * @param {string}        key           - The name of the attribute to test.
 *
 * @return {DESTINATIONS} The destinations the attribute should be put.
 */
AttributeFilter.prototype.filterAll = function filterSegment(destinations, key) {
  return this._filter(DESTINATION_DETAILS, destinations, key)
}

/**
 * Tests a given key against the global and destination filters.
 *
 * @param {array}         scope         - The destination details for filtering.
 * @param {DESTINATIONS}  destinations  - The locations the attribute wants to be put.
 * @param {string}        key           - The name of the attribute to test.
 *
 * @return {DESTINATIONS} The destinations the attribute should be put.
 */
AttributeFilter.prototype._filter = function _filter(scope, destinations, key) {
  // This method could be easily memoized since for a given destination and key
  // the result will always be the same until a configuration update happens. A
  // given application will also have a controllable set of destinations and
  // keys to check.

  // First, see if attributes are even enabled for this destination.
  if (!this.config.attributes.enabled) {
    return DESTINATIONS.NONE
  }

  // These are lazy computed to avoid calculating them for cached results.
  var globalInclude = null
  var globalExclude = null

  // Iterate over each desination and see if the rules apply.
  for (var i = 0; i < scope.length; ++i) {
    var dest = scope[i]
    var destId = dest.id
    var destName = dest.name
    if (!(this._enabledDestinations & destId)) {
      destinations &= ~destId // Remove this destination.
      continue
    }

    // Check for a cached result for this key.
    var result = this._cache[destName][key]
    if (result === undefined) {
      if (globalInclude === null) {
        globalInclude = _matchRules(this._rules.global.include, key)
        globalExclude = _matchRules(this._rules.global.exclude, key)
      }

      // Freshly calculate this attribute.
      var result = _doTest(globalInclude, globalExclude, this._rules[destName], key)
      if (this._cachedCount < this.config.attributes.filter_cache_limit) {
        this._cache[destName][key] = result
        ++this._cachedCount
      }
    }

    if (result === NO_MATCH) {
      // No match, no-op.
    } else if (result) {
      destinations |= destId // Positive match, add it in.
    } else {
      destinations &= ~destId // Negative match, remove it.
    }
  }

  return destinations
}

/**
 * Updates all the rules the given filter has access to.
 */
AttributeFilter.prototype.update = function update() {
  // Update the global rules.
  this._rules.global.include = _importRules(
    this.config.attributes.include_enabled ? this.config.attributes.include : []
  )
  this._rules.global.exclude = _importRules(this.config.attributes.exclude)
  this._cache = Object.create(null)
  this._cachedCount = 0

  // And all the destination rules.
  DESTINATION_DETAILS.forEach(function forEachDestination(dest) {
    var name = dest.name
    if (!this.config[name].attributes.enabled) {
      return
    }

    this._enabledDestinations |= dest.id
    this._rules[name].include = _importRules(
      this.config.attributes.include_enabled ? this.config[name].attributes.include : []
    )
    this._rules[name].exclude = _importRules(this.config[name].attributes.exclude)
    this._cache[name] = Object.create(null)
  }, this)
}

/**
 * Applies the global and destination rules to this key.
 *
 * @private
 *
 * @return {bool|number} True if this key is explicitly included, false if it is
 *  explicitly excluded, or `NO_MATCH` if no rule applies.
 */
function _doTest(globalInclude, globalExclude, destConfig, key) {
  // Check for exclusion of the attribute.
  if (globalExclude === EXACT_MATCH) {
    return false
  }
  var destExclude = _matchRules(destConfig.exclude, key)
  if (destExclude === EXACT_MATCH) {
    return false
  }

  // Then check for inclusion of the attribute.
  if (globalInclude === EXACT_MATCH) {
    return true
  }
  var destInclude = _matchRules(destConfig.include, key)
  if (destInclude === EXACT_MATCH) {
    return true
  }

  // Did any rule match this key? If not, this is a no-match.
  if (
    globalExclude === NO_MATCH &&
    globalInclude === NO_MATCH &&
    destExclude === NO_MATCH &&
    destInclude === NO_MATCH
  ) {
    return NO_MATCH
  }

  // Something has matched this key, so compare the strength of any wildcard
  // matches that have happened.
  return (
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
  return wildcard.test(key) ? wildcard.lastIndex + 1 : NO_MATCH
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
    // '*' => ['\\*']
    return rule.replace(/([.*+?|\\^$()\[\]])/g, function cleaner(m) {
      return '\\' + m
    }).split('.')
  }).reduce(function ruleTransformer(collection, ruleParts) {
    // Step 3) Merge the split rules into a single nested array, deduplicating
    // rule sections as we go.

    // ['foo', 'bar'] => [['foo\\.', ['bar']]]
    // ['foo', 'bang\\*'] => [['foo\\.', ['bar'], ['bang']]]
    // ['fizz', 'bang'] => [['foo\\.', ['bar'], ['bang']], ['fizz\\.', ['bang']]]
    // ['\\*'] => [['foo\\.', ['bar'], ['bang']], ['fizz\\.', ['bang']], ['']]
    add(collection, ruleParts, 0)
    return collection
    function add(c, r, i) {
      var v = r[i]
      if (i !== r.length - 1) {
        v += '.'
      } else if (/\\\*$/.test(v)) {
        v = v.substr(0, v.length - 2)
      }

      var idx = c.findIndex(function findV(a) {
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
    // [''] => ''
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
