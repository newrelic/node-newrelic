'use strict';

function MetricSpec(name, scope) {
  this.name = name;
  this.scope = scope;
}

MetricSpec.prototype.toJSON = function () {
  var hash = {'name' : this.name};
  if (this.scope) hash.scope = this.scope;

  return hash;
};

module.exports = MetricSpec;
