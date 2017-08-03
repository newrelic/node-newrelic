'use strict'
var semver = require('semver')

if (semver.satisfies(process.version, "<8")) {
  console.log('async hooks are not supported in node version: ' + process.version)
  return
}

require('./async_hooks.js')
