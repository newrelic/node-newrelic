'use strict';

var path     = require('path')
  , fs       = require('fs')
  , util     = require('util')
  , Q        = require('q')
  , exec     = Q.nfbind(require('child_process').exec)
  , recreate = require(path.join(__dirname, 'recreate'))
  , Timer    = require(path.join(__dirname, '..', '..', 'lib', 'timer'))
  ;

/*
 * CONSTANTS
 */
var IMPATIENCE = 20000;

function dumpError(error, info, status) {
  var filename = util.format("%s_%s_%s.log", status, info.name,
                             info.version.replace(/\./, '-'))
    , output   = path.join(info.prefix, 'build-errors', filename)
    ;

  fs.writeFileSync(output, error.message);
}

var installer = module.exports = {
  versions : function (target) {
    function toJSON(text) {
      return JSON.parse(text);
    }

    function lookupFailed(error) {
      console.log("Unable to look up versions of %s to test: %s", target, error);
    }

    return exec('npm view --json ' + target + ' versions')
             .spread(toJSON)
             .fail(lookupFailed);
  },

  install : function (prefix, target, version) {
    var versioned = target + '@' + version
      , command   = util.format('npm install --prefix %s %s', prefix, versioned)
      ;

    function metadata() {
      return {
        prefix   : prefix,
        name     : target,
        version  : version
      };
    }

    // sometimes install failures go off to the moon, set timeout
    return exec(command, {timeout : IMPATIENCE})
      .then(metadata);
  },

  visitVersion : function (prefix, target, version, visitor) {
    var timer = new Timer();

    function stopTimer() {
      timer.end();

      return metadata();
    }

    function getDuration(timer) {
      return timer.getDurationInMillis() / 1000;
    }

    function metadata() {
      return {
        prefix   : prefix,
        name     : target,
        version  : version,
        duration : getDuration(timer)
      };
    }

    function failed(error) {
      var info = stopTimer();

      if (error.killed) {
        console.error("%s %s install FAILED after %ss: multiverse killed slow install.",
                      target, version, info.duration.toFixed(2));
        dumpError(error, info, 'timeout');
      }
      else if (error.signal) {
        console.error("%s %s install FAILED after %ss: process killed (signal %s).",
                      target, version, info.duration.toFixed(2), error.signal);
        dumpError(error, info, 'killed');
      }
      else {
        console.error("%s %s install FAILED after %ss: exited (code %s).",
                      target, version, info.duration.toFixed(2), error.code);
        dumpError(error, info, 'crashed');
      }
    }

    timer.begin();
    return installer.install(prefix, target, version)
             .then(stopTimer)
             .then(visitor)
             .fail(failed);
  },

  visitAll : function (prefix, target, visitor) {
    /* Installs and visits must happen sequentially so node_modules doesn't
     * get stomped mid-run.
     */
    function installAndVisit(versions, index, result) {
      if (!versions[index]) return result;

      return installer.visitVersion(prefix, target, versions[index], visitor)
               .then(installAndVisit.bind(null, versions, index - 1));
    }

    function installAll(versions) {
      console.log("Installing %s versions of %s.", versions.length, target);

      recreate(prefix, 'build-errors');

      return installAndVisit(versions, versions.length - 1);
    }

    return installer.versions(target).then(installAll);
  }
};
