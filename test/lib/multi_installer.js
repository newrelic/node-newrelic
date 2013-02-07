'use strict';

var path         = require('path')
  , util         = require('util')
  , exec         = require('child_process').exec
  , install      = require(path.join(__dirname, 'install'))
  , EventEmitter = require('events').EventEmitter
  ;

function MultiInstaller(target, prefix) {
  if (!target || !prefix) throw new Error("Missing required parameters!");

  EventEmitter.call(this);

  this.target = target;
  this.prefix = prefix;
}
util.inherits(MultiInstaller, EventEmitter);

MultiInstaller.prototype.versions = function (callback) {
  exec(
    'npm view --json ' + this.target + ' versions',
    function (error, stdout) {
      if (error) return callback(error);

      callback(null, JSON.parse(stdout));
    }
  );
};

MultiInstaller.prototype._each = function(versions, callback) {
  var version = versions.pop();
  install(this.target, version, this.prefix, function (error, results) {
    callback(error, results);

    if (versions.length > 0) {
      this._each(versions, callback);
    }
    else if (this._done) {
      this.emit('finished');
    }
  }.bind(this));
};

MultiInstaller.prototype.each = function (callback) {
  this.versions(function (error, versions) {
    if (error) return console.error(error.stack);

    this._each(versions, callback);
  }.bind(this));
};

module.exports = MultiInstaller;
