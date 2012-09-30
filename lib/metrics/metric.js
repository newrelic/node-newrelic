'use strict';

var path       = require('path')
  , ApdexStats = require(path.join(__dirname, '..', 'stats', 'apdex'))
  , Stats      = require(path.join(__dirname, '..', 'stats'))
  ;

/**
 * A metric is a name, with an optional scope. The resulting metric will have
 * either regular or apdex statistics associated with it, depending on whether
 * it was created with an apdexT value or not.
 *
 * @param {string} name The name of the metric, in path format.
 * @param {string} scope (optional) The scope to which this metric is bound.
 * @param {float}  apdexT (optional) This is an apdex-enhanced timer with an
 *                        apdex time of apdexT.
 */
function Metric(name, scope, apdexT) {
  if (!name) throw new Error('Metrics must be named');

  this.name  = name;
  this.scope = scope;

  if (apdexT || apdexT === 0) {
    this.stats = new ApdexStats(apdexT);
  }
  else {
    this.stats = new Stats();
  }
}

/**
 * The serialized representation of Metrics doesn't include statistics by
 * default, and only includes scope property if one is set. Since the name
 * can also be an ID (set by the metric renaming rules code elsewhere), if
 * the name is numeric, serialize as the ID, as per
 *
 * https://hudson.newrelic.com/job/collector-master/javadoc/com/nr/collector/datatypes/MetricData.html
 *
 * @returns {object} Either a dictionary of the name (and optionally, scope)
 *                   of the Metric, or, if the name is numeric (which means
 *                   that it's been mapped to an ID by the server), just the
 *                   number.
 */
Metric.prototype.toJSON = function () {
  if (!isNaN(parseFloat(this.name)) && isFinite(this.name)) {
    return this.name;
  }
  else {
    var hash;
    hash = {'name' : this.name};
    if (this.scope) hash.scope = this.scope;

    return hash;
  }
};

/**
 * Convert to a serializable representation that includes the object's stats.
 * The result, a 2-element array, is meant to be have toJSON called on each
 * element.
 *
 * @param {RenameRules} renamer A dictionary mapping metric names to renamed
 *                      targets.
 * @returns {Array} A 2-element pair consisting of the Metric and its
 *                  associated statistics.
 */
Metric.prototype.toData = function (renamer) {
  var metric = this;

  if (renamer) {
    var target = renamer.lookup(this.name, this.scope);
    if (target) metric = new Metric(target, this.scope);
  }

  // metric data is just a metric spec & statistics pair
  return [metric, this.stats];
};

module.exports = Metric;
