var logger = require('../../logger').child({component : 'tx_segment_normalizer'})

module.exports = TxSegmentNormalizer

function TxSegmentNormalizer() {
  this.terms = []
}

/**
 * This normalize method is wicked. The best bet is to read the spec:
 * https://newrelic.atlassian.net/wiki/pages/viewpage.action?spaceKey=eng&title=Language+agent+transaction+segment+terms+rules
 * A copy paste of the rules that were followed:
 *  1. Find the first rule where the prefix key matches the prefix of the
 *     transaction name. If no matching rules are found, abort.
 *  2. Strip the prefix from the transaction name.
 *  3. Split the rest of the transaction name into segments on slashes ('/').
 *  4. For each segment:
 *      If the segment appears in the array of strings given under the terms key, keep it unchanged.
 *      Else, replace it with a placeholder ('*')
 *  5. Collapse all adjacent placeholder segments into a single '*' segment.
 *  6. Join together the modified segments with slashes, and re-prepend the prefix
 */
TxSegmentNormalizer.prototype.normalize = function normalize(path) {
  var result = path
  var currentTerm
  var prefix
  for (var i = 0; i < this.terms.length; i++) {
    currentTerm = this.terms[i]
    prefix = currentTerm.prefix
    if (path.lastIndexOf(prefix, 0) === -1) {
      continue
    }
    var fragment = path.slice(prefix.length)
    var parts = fragment.split('/')

    // If there is no / boundary between prefix and the start, turn the first
    // element in to *
    if (prefix[prefix.length-1] !== '/' && fragment[0] !== '/') {
      parts[0] = '*'
    }

    var segment
    // Iterate negatively because we mutate the array.
    for (var j = parts.length-1; j >= 0; j--) {
      segment = parts[j]
      if (segment === '') {
        continue
      }
      if (currentTerm.terms.indexOf(segment) === -1) {
        if (parts[j+1] === '*') {
          parts.splice(j, 1)
        } else {
          parts[j] = '*'
        }
      }
    }
    logger.trace('Normalizing %s because of rule: %s', path, currentTerm)
    return prefix + parts.join('/')
  }
  return result
}

TxSegmentNormalizer.prototype.load = function load(json) {
  if (Array.isArray(json)) {
    this.terms = json
  } else {
    logger.warn(
      'transaction_segment_terms was not an array got: %s (%s)',
      typeof json,
      json
    )
  }
}