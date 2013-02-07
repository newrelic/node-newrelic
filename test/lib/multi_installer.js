'use strict';

var path    = require('path')
  , exec    = require('child_process').exec
  , async   = require('async')
  , install = require(path.join(__dirname, 'install'))
  ;

function MultiInstaller(target, prefix) {
  if (!target || !prefix) throw new Error("Missing required parameters!");

  this.target = target;
  this.prefix = prefix;
}

MultiInstaller.prototype.versions = function (callback) {
  exec(
    'npm view --json ' + this.target + ' versions',
    function (error, stdout) {
      if (error) return callback(error);

      callback(null, JSON.parse(stdout));
    }
  );
};

MultiInstaller.prototype.forEach = function (visitor, callback) {
  this.versions(function (error, versions) {
    if (error) return callback(error);

    async.forEachSeries(
      versions.reverse(),
      function (version, nested) {
        install(this.target, version, this.prefix, function (error, results) {
          visitor(error, results, nested);
        });
      }.bind(this),
      callback
    );
  }.bind(this));
};

module.exports = MultiInstaller;
