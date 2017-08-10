'use strict'
var semver = require('semver')

if (semver.satisfies(process.version, "<8")) {
  console.log('async hooks are not supported in node version: ' + process.version)
  return
}

var exec = require('child_process').execSync
exec('node --expose-gc ./async_hooks.js', {
  stdio: 'inherit',
  cwd: __dirname
})
