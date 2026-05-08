/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const concatStream = require('concat-stream')
const cp = require('child_process')
const fs = require('fs')
const EventEmitter = require('events').EventEmitter
const path = require('path')
const util = require('util')
require('colors')

const TestMatrix = require('./matrix')

const TEST_EXECUTOR = path.resolve(__dirname, './runner.js')

/**
 * Filters the test files based on testPatterns
 *
 * @param {Array} tests list of tests
 * @param {Array} testPatterns patterns to match against list
 * @returns {Array} all test files that match test patterns
 */
function filterTestsByPattern(tests, testPatterns) {
  return tests
    .map((test) => {
      const newTest = { ...test }
      newTest.files = test.files.filter((file) => (
        testPatterns.filter((pattern) => file.indexOf(pattern) > -1).length > 0
      ))
      return newTest
    })
    .filter((test) => !!test.files.length)
}

function Test(directory, pkgVersions, opts = {}) {
  const { testPatterns, globalSamples } = opts
  const pkg = require(path.join(directory, 'package'))
  const dirname = path.basename(directory)

  // compare test files included in specification
  // against files that actually exist.
  this.missingFiles = []
  const uniqSoughtFiles = new Set()
  for (const test of pkg.tests) {
    for (const file of test.files) {
      uniqSoughtFiles.add(file)
    }
  }
  const allFiles = fs.readdirSync(directory).filter((name) => /^.*\.(tap|test)\.js$/.test(name))
  for (const file of allFiles) {
    if (!uniqSoughtFiles.has(file)) {
      const filePath = path.join(directory, file)
      this.missingFiles.push(filePath)
    }
  }

  this.name = dirname === 'versioned' ? pkg.name : dirname
  this.directory = directory

  let tests = pkg.tests
  if (testPatterns && testPatterns.length > 0) {
    tests = filterTestsByPattern(tests, testPatterns)
  }

  this.matrix = new TestMatrix(tests, pkgVersions, globalSamples)
  this.runs = 0
  this.failed = false
  this.currentRun = null
  this.previousRun = null
  this.duration = 0
  this.strict = !!opts.strict
  this.type = pkg.type || 'commonjs'
}

Test.prototype.next = function next() {
  const task = this.matrix.next()
  if (task) {
    task.test = path.join(this.directory, task.test)
  }

  return task
}

Test.prototype.peek = function peek() {
  const task = this.matrix.peek()
  if (task) {
    task.test = path.join(this.directory, task.test)
  }

  return task
}

Test.prototype.run = function run() {
  const task = this.next()
  if (!task) {
    return null
  }

  this.previousRun = this.currentRun
  this.currentRun = task
  ++this.runs
  this.failed = false
  const self = this

  // Calculate package differences to determine when all package
  // combinations have been tested
  const pkgs = this._getPackageDiff(this.previousRun, task)

  // format packages to provide exact version install
  // (e.g redis@1.2.1)
  task.packageVersions = Object.keys(task.packages).map((pkg) => `${pkg}@${task.packages[pkg]}`)

  const additionalArgs = {
    PKG_TYPE: this.type
  }

  if (this.type === 'module' && process.env.NR_LOADER) {
    // The test loader is defined in the agent, so this uses process.cwd() instead of __directory.
    const cwd = process.cwd()
    const loaderPath = path.resolve(cwd, process.env.NR_LOADER)
    // changing env var for loader so subsequent commonjs
    // runs that have NR_LOADER do not try to load it
    additionalArgs.NR_LOADER = loaderPath
  }

  // Spawn another runner instance with list of packages to install
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const child = cp.spawn('node', [TEST_EXECUTOR, task.test].concat(task.packageVersions), {
    cwd: this.directory,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, ...additionalArgs }
  })

  const testRun = new TestRun(child, pkgs.length > 0)
  testRun.on('end', function endHandler() {
    self.duration += testRun.duration
    self.stdout = testRun.stdout
    self.stderr = testRun.stderr
  })

  return testRun
}

Test.prototype.nextNeedsInstall = function nextNeedsInstall() {
  const task = this.next()
  if (!task) {
    return false
  }

  const pkgs = this._getPackageDiff(this.currentRun, task)
  return pkgs && pkgs.length > 0
}

Test.prototype._getPackageDiff = function _getPackageDiff(a, b) {
  // Find all packages in `b` whose values differ from `a`.
  return Object.keys(b.packages)
    .filter((pkg) => !a || a.packages[pkg] !== b.packages[pkg])
    .map((pkg) => pkg + '@' + b.packages[pkg])
}

function TestRun(child, needsInstall) {
  const self = this
  EventEmitter.call(this)
  this._child = child
  this.needsInstall = needsInstall
  this.duration = 0
  this._start = null

  child.on('message', function messageHandler(msg) {
    if (msg.status === 'completed') {
      const hrduration = process.hrtime(self._start)
      self.duration += hrduration[0] * 1e3 + hrduration[1] * 1e-6
    }
    self.emit(msg.status)
  })

  child.on('exit', function exitHandler(code) {
    self.failed = code !== 0
    if (code < 0) {
      self.emit('error', new Error('Child errored: ' + code))
    }
    self.emit('end')
  })

  child.stdout.pipe(
    concatStream(function stdoutStream(output) {
      self.stdout = output.toString('utf8')
    })
  )
  child.stderr.pipe(
    concatStream(function stderrStream(output) {
      self.stderr = output.toString('utf8')
    })
  )
}
util.inherits(TestRun, EventEmitter)

TestRun.prototype.continue = function cont() {
  this._start = process.hrtime()
  this._child.send({ command: 'continue' })
}

module.exports = Test
