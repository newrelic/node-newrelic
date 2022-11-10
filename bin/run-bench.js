/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/* eslint sonarjs/cognitive-complexity: ["error", 21] -- TODO: https://issues.newrelic.com/browse/NEWRELIC-5252 */

// const a = require('async')
const cp = require('child_process')
const glob = require('glob')
const path = require('path')

const cwd = path.resolve(__dirname, '..')
const benchpath = path.resolve(cwd, 'test/benchmark')

const tests = []
const globs = []
const opts = Object.create(null)

const fakeCb = (err, payload) => {
  if (err) {
    console.error(err)
    return
  }
  return payload
}

process.argv.slice(2).forEach(function forEachFileArg(file) {
  if (/^--/.test(file)) {
    opts[file.substring(2)] = true
  } else if (/[*]/.test(file)) {
    globs.push(path.join(benchpath, file))
  } else if (/\.bench\.js$/.test(file)) {
    tests.push(path.join(benchpath, file))
  } else {
    globs.push(
      path.join(benchpath, file, '*.bench.js'),
      path.join(benchpath, `${file}*.bench.js`),
      path.join(benchpath, file, '**/*.bench.js')
    )
  }
})

if (tests.length === 0 && globs.length === 0) {
  globs.push(path.join(benchpath, '*.bench.js'), path.join(benchpath, '**/*.bench.js'))
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
    child.stdout.on('data', (d) => (output += d.toString()))
    child.stdout.on('end', () => (this._tests[name] = JSON.parse(output)))
    child.stderr.on('data', (d) => process.stderr.write(d))
  }

  finish() {
    /* eslint-disable no-console */
    console.log(JSON.stringify(this._tests, null, 2))
    /* eslint-enable no-console */
  }
}

run()

const errorAndExit = (err, message, code) => {
  console.log(message)
  console.error(err)
  process.exit(code)
}

async function run() {
  const printer = opts.json ? new JSONPrinter() : new ConsolePrinter()

  const resolveGlobs = (cb) => {
    if (!globs.length) {
      cb()
    }
    const afterGlobbing = (err, resolved) => {
      if (err) {
        errorAndExit(err, 'Failed to glob', -1)
        cb(err)
      }
      resolved.forEach(function mergeResolved(files) {
        files.forEach(function mergeFile(file) {
          if (tests.indexOf(file) === -1) {
            tests.push(file)
          }
        })
      })
      cb() // ambient scope
    }

    const globbed = globs.map((item) => glob.sync(item))
    return afterGlobbing(null, globbed)
  }

  const spawnEachFile = (file, spawnCb) => {
    const test = path.relative(benchpath, file)

    const args = [file]
    if (opts.inspect) {
      args.unshift('--inspect-brk')
    }

    // / TODO: remove diagnostic --trace-warnings
    args.push('--trace-warnings')

    const child = cp.spawn('node', args, { cwd: cwd, stdio: 'pipe' })
    printer.addTest(test, child)

    child.on('error', spawnCb)
    child.on('exit', function onChildExit(code) {
      if (code) {
        spawnCb(new Error('Benchmark exited with code ' + code))
      }
      spawnCb()
    })
  }

  const afterSpawnEachFile = (err, cb) => {
    if (err) {
      errorAndExit(err, 'Spawning failed:', -2)
      return cb(err)
    }
    cb()
  }

  const runBenchmarks = async (cb) => {
    tests.sort()
    await tests.forEach((file) => spawnEachFile(file, fakeCb))
    await afterSpawnEachFile(null, fakeCb)
    return cb()
  }

  await resolveGlobs(fakeCb)
  await runBenchmarks(fakeCb)
  printer.finish()
}
