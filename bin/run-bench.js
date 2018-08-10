'use strict'

var a = require('async')
var cp = require('child_process')
var glob = require('glob')
var path = require('path')


var cwd = path.resolve(__dirname, '..')
var benchpath = path.resolve(cwd, 'test/benchmark')

var tests = []
var globs = []
var opts = Object.create(null)

process.argv.slice(2).forEach(function forEachFileArg(file) {
  if (/^--/.test(file)) {
    opts[file.substr(2)] = true
  } else if (/[*]/.test(file)) {
    globs.push(path.join(benchpath, file))
  } else if (/\.bench\.js$/.test(file)) {
    tests.push(path.join(benchpath, file))
  } else {
    globs.push(
      path.join(benchpath, file, '*.bench.js'),
      path.join(benchpath, file + '*.bench.js'),
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

class ConsolePrinter {
  /* eslint-disable no-console */
  addTest(name, child) {
    console.log(name)
    child.stdout.on('data', (d) => process.stdout.write(d))
    child.stderr.on('data', (d) => process.stderr.write(d))
    child.once('exit', () => console.log(''))
  }

  finish() {
    console.log('')
  }
  /* eslint-enable no-console */
}

class JSONPrinter {
  constructor() {
    this._tests = Object.create(null)
  }

  addTest(name, child) {
    let output = ''
    this._tests[name] = null
    child.stdout.on('data', (d) => output += d.toString())
    child.stdout.on('end', () => this._tests[name] = JSON.parse(output))
    child.stderr.on('data', (d) => process.stderr.write(d))
  }

  finish() {
    /* eslint-disable no-console */
    console.log(JSON.stringify(this._tests, null, 2))
    /* eslint-enable no-console */
  }
}

run()

function run() {
  const printer = opts.json ? new JSONPrinter() : new ConsolePrinter()

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

        var args = [file]
        if (opts.inspect) {
          args.unshift('--inspect-brk')
        }
        var child = cp.spawn('node', args, {cwd: cwd, stdio: 'pipe'})
        printer.addTest(test, child)

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
  ], () => {
    printer.finish()
  })
}
