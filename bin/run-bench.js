/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/* eslint sonarjs/cognitive-complexity: ["error", 23] -- TODO: https://issues.newrelic.com/browse/NEWRELIC-5252 */

const cp = require('child_process')
const glob = require('glob')
const path = require('path')
const { errorAndExit } = require('./utils')

const cwd = path.resolve(__dirname, '..')
const benchpath = path.resolve(cwd, 'test/benchmark')

const tests = []
const testPromises = []
const globs = []
const opts = Object.create(null)

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
    child.stdout.on('data', (d) => (output += d.toString()))
    child.stderr.on('data', (d) => process.stderr.write(d))

    this._tests[name] = new Promise((resolve) => {
      child.stdout.on('end', () => {
        this._tests[name] = JSON.parse(output)
        resolve()
      })
    })
  }

  finish() {
    /* eslint-disable no-console */
    console.log(JSON.stringify(this._tests, null, 2))
    /* eslint-enable no-console */
  }
}

run()

async function run() {
  const printer = opts.json ? new JSONPrinter() : new ConsolePrinter()

  const resolveGlobs = () => {
    if (!globs.length) {
      console.error(`There aren't any globs to resolve.`)
      return
    }
    const afterGlobbing = (resolved) => {
      if (!resolved) {
        return errorAndExit(new Error('Failed to glob'), 'Failed to glob', -1)
      }

      function mergeFile(file) {
        if (tests.indexOf(file) === -1) {
          tests.push(file)
        }
      }
      function mergeResolved(files) {
        files.forEach(mergeFile)
      }

      return resolved.forEach(mergeResolved)
    }

    const globbed = globs.map((item) => glob.sync(item))
    return afterGlobbing(globbed)
  }

  const spawnEachFile = async (file) => {
    const test = path.relative(benchpath, file)

    const args = [file]
    if (opts.inspect) {
      args.unshift('--inspect-brk')
    }

    const child = cp.spawn('node', args, { cwd: cwd, stdio: 'pipe', silent: true })

    child.on('error', (err) => {
      console.error(`*** error in child test ${test}`, err)
      throw err
    })
    child.on('exit', function onChildExit(code) {
      if (code) {
        console.error(`Benchmark test ${test} exited with code ${code}`)
        return
      }
      console.log(`The child test ${file} has completed`)
    })
    printer.addTest(test, child)
  }

  const runBenchmarks = async () => {
    tests.sort()
    for await (const file of tests) {
      await spawnEachFile(file)
    }
    if (opts.json) {
      // if json, we need to track promises
      const keys = Object.keys(printer._tests)
      for (const key of keys) {
        testPromises.push(printer._tests[key])
      }
    }
  }

  await resolveGlobs()
  await runBenchmarks()
  if (opts.json) {
    await Promise.all(testPromises)
  }
  printer.finish()
}
