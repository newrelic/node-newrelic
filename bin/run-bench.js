'use strict'

var a = require('async')
var cp = require('child_process')
var glob = require('glob')
var path = require('path')


var cwd = path.resolve(__dirname, '..')
var benchpath = path.resolve(cwd, 'test/benchmark')

glob(path.resolve(benchpath, '**/*.bench.js'), function globCb(err, files) {
  if (err) {
    return console.error('Failed to glob:', err)
  }

  a.eachSeries(files, function spawnEachFile(file, cb) {
    var test = path.relative(benchpath, file)

    console.log(test)
    var child = cp.spawn('node', [file], {cwd: cwd, stdio: 'inherit'})
    child.on('error', cb)
    child.on('exit', function onChildExit(code) {
      if (code) {
        return cb(new Error('Benchmark exited with code ' + code))
      }
      cb()
    })
  }, function afterSpawnEachFile(err) {
    if (err) {
      console.error('Spawning failed:', err)
    }
  })
})
