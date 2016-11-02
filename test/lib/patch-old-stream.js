/*
 * This is a patch for older versions of streams to get v0.8 to work
 * with newer versions of restify, which we use for mocking out the
 * collector.
 */
var semver = require('semver')
if (semver.satisfies(process.version, '0.8.x')) {
  var ReadableStream = require('readable-stream')
  var Stream = require('stream')
  var outdatedMethods = [
    'Readable',
    'Transform',
    'Writable'
  ]
  outdatedMethods.forEach(function (key) {
    Stream[key] = ReadableStream[key]
  })
}
