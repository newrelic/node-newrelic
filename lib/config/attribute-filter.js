'use strict'

var NO_MATCH = 0
var EXPLICIT_MATCH = Infinity


module.exports = AttributeFilter

function AttributeFilter(config) {
  this.config = config
}

AttributeFilter.prototype.test = function test(destination, key) {
  // First, see if attributes are even enabled for this destination.
  var globalConfig = this.config.attributes
  if (!globalConfig.enabled) {
    return false
  }
  var destConfig = this.config[destination]
  if (!destConfig.enabled) {
    return false
  }

  // Then check for exclusion of the attribute.
  var globalExclude = _matchConfig(globalConfig.exclude, key)
  if (globalExclude === EXPLICIT_MATCH) {
    return false
  }
  var destExclude = _matchConfig(destConfig.exclude, key)
  if (destExclude === EXPLICIT_MATCH) {
    return false
  }

  // Then check for inclusion of the attribute.
  var globalInclude = _matchConfig(globalConfig.include, key)
  if (globalInclude === EXPLICIT_MATCH) {
    return true
  }
  var destInclude = _matchConfig(destConfig.include, key)
  if (destInclude === EXPLICIT_MATCH) {
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

function _matchConfig(rules, key) {
  var bestMatch = NO_MATCH
  for (var i = 0; i < rules.length && bestMatch !== EXPLICIT_MATCH; ++i) {
    bestMatch = Math.max(bestMatch, _checkRule(rules[i], key))
  }

  return bestMatch
}

function _checkRule(rule, key) {
  // If the rule is not wildcard, see if it is an EXPLICIT_MATCH!
  if (rule[rule.length - 1] !== '*') {
    return rule === key ? EXPLICIT_MATCH : NO_MATCH
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
