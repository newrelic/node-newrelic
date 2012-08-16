'use strict';

var path = require('path')
  , logger = require(path.join(__dirname, '..', 'logger'))
  ;

function RenameRules(raw) {
  this.unscoped = {};
  this.scoped = {};
  this.length = 0;

  this.parse(raw);
}

RenameRules.prototype.parse = function (raw) {
  if (raw) {
    for (var i = 0; i < raw.length; i++) {
      var spec = raw[i][0];
      var id   = raw[i][1];

      if (!this.resolveScope(spec.scope)[spec.name]) this.length += 1;
      this.resolveScope(spec.scope)[spec.name] = id;
    }
    logger.debug("Parsed " + raw.length + " metric ids (" + this.length + " total)");
  }
};

RenameRules.prototype.lookup = function (name, scope) {
  if (scope) {
    if (this.scoped[scope]) return this.scoped[scope][name];
  }
  else {
    return this.unscoped[name];
  }
};

RenameRules.prototype.resolveScope = function (scope) {
  var resolved;

  if (scope) {
    if (!this.scoped[scope]) this.scoped[scope] = {};

    resolved = this.scoped[scope];
  }
  else {
    resolved = this.unscoped;
  }

  return resolved;
};

module.exports = RenameRules;
