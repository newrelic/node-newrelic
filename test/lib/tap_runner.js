'use strict'

var path     = require('path')
  , Q        = require('Q')
  , Qx       = require('Qx')
  , fs       = require('fs')
  , readdir  = Q.nfbind(fs.readdir)
  , exec     = require('child_process').exec
  , tap      = require('tap')
  , recreate = require('./recreate')
  , Timer    = require('../../lib/timer')
  


/*
 * CONSTANTS
 */
var IMPATIENCE      = 30000
  , DEFAULT_COMMAND = 'node'
  

function isTapFile(name) {
  return name.match(/\.tap\.js$/)
}

function onlyTapFiles(files) {
  return Qx.filter(files, isTapFile)
}

module.exports = function (info) {
  function runTapFile(index, files, result) {
    if (!files[index]) return result

    var timer = new Timer()
      , deferred = Q.defer()
      

    timer.begin()

    function execed(error) {
      if (error) return deferred.reject(error)

      deferred.resolve()
    }

    var filepath = path.join(info.prefix, files[index])
      , command  = info.command || DEFAULT_COMMAND
      , producer = exec(command + ' ' + filepath, {timeout : IMPATIENCE}, execed)
      , consumer = tap.createConsumer()
      , busted   = 0
      , tests    = 0
      

    function onTapData(data) {
      if (data.ok === true) {
        tests++
        return
      }
      else if (data.ok === false) {
        tests++
        busted++
        // console.dir(data);
      }
      else {
        // console.log(data);
      }
    }

    function getDuration(timer) {
      return (timer.getDurationInMillis() / 1000).toFixed(2)
    }

    function failed(error) {
      timer.end()

      if (error.killed) {
        console.error("%s %s: %s failures (out of %s asserts). " +
                      "Installed in %ss, suite killed after %ss.",
                      info.name, info.version, busted, tests,
                      info.duration.toFixed(2), getDuration(timer))
      }
      else if (error.signal) {
        console.error("%s %s: %s failures (out of %s asserts). " +
                      "Installed in %ss, SUITE DIED (signal %s) after %ss.",
                      info.name, info.version, busted, tests,
                      info.duration.toFixed(2), error.signal, getDuration(timer))
      }
      else {
        console.error("%s %s: %s failures (out of %s asserts). " +
                      "Installed in %ss, SUITE EXITED (code %s) after %ss.",
                      info.name, info.version, busted, tests,
                      info.duration.toFixed(2), error.code, getDuration(timer))
      }
    }

    function finished() {
      timer.end()

      console.log("%s %s: %s failures (out of %s asserts). " +
                  "Installed in %ss, tested in %ss.",
                  info.name, info.version, busted, tests,
                  info.duration.toFixed(2),
                  (timer.getDurationInMillis() / 1000).toFixed(2))
    }

    consumer.on('data', onTapData)
    producer.stdout.pipe(consumer)

    return deferred.promise
             .then(finished, failed)
             .then(runTapFile.bind(null, index + 1, files))
  }

  recreate(info.prefix, 'tap')

  return readdir(info.prefix).then(onlyTapFiles).then(runTapFile.bind(null, 0))
}
