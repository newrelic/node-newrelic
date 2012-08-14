'use strict';

var path = require('path')
  , ApdexStats = require(path.join(__dirname, '..', 'stats', 'apdex'))
  , Stats = require(path.join(__dirname, '..', 'stats'))
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

  this.name = name;
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
 * default, and only includes scope property if one is set.
 *
 * @returns {object} Dictionary of the name (and optionally, scope) of the
 *                   Metric.
 */
Metric.prototype.toJSON = function () {
  var hash = {'name' : this.name};
  if (this.scope) hash.scope = this.scope;

  return hash;
};

/**
 * Convert to a serializable representation that includes the object's stats.
 * The result, a 2-element array, is meant to be have toJSON called on each
 * element.
 *
 * @param {Array} metricIds A dictionary of metric renaming rules, with the
 *                          key and value. The keys are 2-element arrays
 *                          consisting of the metric's name and scope. Yes,
 *                          this is fragile.
 * @returns {Array} A 2-element pair consisting of the Metric and its
 *                  associated statistics.
 */
Metric.prototype.toData = function (metricIds) {
  var metric = this;

  // FIXME: this is an opaque and fragile representation of renaming rules
  var key = [this.name, this.scope];
  if (metricIds && metricIds[key]) metric = metricIds[key];

  // metric data is just a metric spec & statistics pair
  return [metric, this.stats];
};

module.exports = Metric;
