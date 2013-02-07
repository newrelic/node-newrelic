'use strict';

var util = require('util')
  , exec = require('child_process').exec
  ;

/*
 * CONSTANTS
 */
var IMPATIENCE = 15000;

module.exports = function install(name, version, prefix, callback) {
  var versioned = name + '@' + version
    , command   = util.format('npm install --prefix %s %s', prefix, versioned)
    ;

  exec(
    command,
    // sometimes MongoDB install failures go off to the moon
    {timeout : IMPATIENCE},
    function (error) {
      callback(error, {prefix : prefix, name : name, version : version});
    }
  );
};
