'use strict'

var a = require('async')
var cp = require('child_process')
var glob = require('glob')
var path = require('path')


var cwd = path.resolve(__dirname, '..')
var benchpath = path.resolve(cwd, 'test/benchmark')

var tests = []
var globs = []

process.argv.slice(2).forEach(function forEachFileArg(file) {
  if (/[*]/.test(file)) {
    globs.push(path.join(benchpath, file))
  } else if (/\.bench\.js$/.test(file)) {
    tests.push(path.join(benchpath, file))
  } else {
    globs.push(
      path.join(benchpath, file, '*.bench.js'),
      path.join(benchpath, file, '**/*.bench.js')
    )
  }
})

if (tests.length === 0 && globs.length === 0) {
  globs.push(
    path.join(benchpath, '*.bench.js'),
    path.join(benchpath, '**/*.bench.js')
  )
}

a.series([
  function resolveGlobs(cb) {
    if (!globs.length) {
      return cb()
    }

    a.map(globs, glob, function afterGlobbing(err, resolved) {
      if (err) {
        console.error('Failed to glob:', err)
        process.exitCode = -1
        return cb(err)
      }
      resolved.forEach(function mergeResolved(files) {
        files.forEach(function mergeFile(file) {
          if (tests.indexOf(file) === -1) {
            tests.push(file)
          }
        })
      })
      cb()
    })
  },
  function runBenchmarks(cb) {
    tests.sort()
    a.eachSeries(tests, function spawnEachFile(file, cb) {
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
        process.exitCode = -2
        return cb(err)
      }
      cb()
    })
  }
])
