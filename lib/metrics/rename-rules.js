'use strict';

var path   = require('path')
  , util   = require('util')
  , logger = require(path.join(__dirname, '..', 'logger'))
      .child({component : 'metric_id'})
  ;

function RenameRules(raw) {
  this.unscoped = {};
  this.scoped = {};
  this.length = 0;

  this.load(raw);
}

RenameRules.prototype.load = function (raw) {
  if (raw && raw.length) {
    for (var i = 0; i < raw.length; i++) {
      var spec = raw[i][0];
      var id   = raw[i][1];

      if (!this.resolveScope(spec.scope)[spec.name]) this.length += 1;
      this.resolveScope(spec.scope)[spec.name] = id;
      logger.trace("Metric spec %s has been mapped to ID %d.", util.inspect(spec), id);
    }
    logger.debug("Parsed %d metric ids (%d total).", raw.length, this.length);
  }
  else {
    return logger.debug('No new metric renaming rules from server.');
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
