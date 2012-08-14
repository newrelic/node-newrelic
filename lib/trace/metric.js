'use strict';

/**
 * A metric is a name, with an optional scope.
 *
 * @param {string} name The name of the metric, in path format.
 * @param {string} scope (optional) the scope to which this metric is bound
 */
function Metric(name, scope) {
   this.name = name;
   this.scope = scope;
}

Metric.prototype.toJSON = function () {
  var hash = {'name' : this.name};
  if (this.scope) hash.scope = this.scope;

  return hash;
};

module.exports = Metric;
