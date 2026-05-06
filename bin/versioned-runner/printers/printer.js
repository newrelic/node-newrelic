/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

require('colors')
const path = require('path')
const HR = '==============================================================='

/* eslint-disable no-console */

function TestPrinter(tests, opts) {
  this.tests = tests
    .map((tPath) => {
      const tDir = path.dirname(tPath)
      let tName = path.basename(tDir)
      if (tName === 'versioned') {
        tName = require(path.join(tDir, 'package')).name
      }
      return { name: tName, status: 'created', test: null }
    })
    .reduce((testMap, t) => {
      testMap[t.name] = t
      return testMap
    }, {})

  this.opts = opts
  this.updated = false

  this.interval = setInterval(this.maybePrint.bind(this), opts.refresh)
}

TestPrinter.HR = HR

TestPrinter.prototype.maybePrint = function maybePrint() {
  if (this.updated) {
    this.updated = false
    this.print()
  }
}

TestPrinter.prototype.printVersionedMatrix = function printVersionedMatrix() {
  console.log('Versions executed\n')

  for (const pkg in this.tests) {
    const versions = this.tests[pkg].test.matrix.versionsByPkg
    if (versions.length) {
      console.log(`Folder: ${pkg}`)
      console.log(`\t * ${versions.join('\n\t * ')}`)
    } else {
      console.log(`Folder: ${pkg}(SKIPPED)`)
    }
  }
  console.log(HR)
}

TestPrinter.prototype.maybePrintMissing = function maybePrintMissing() {
  const missingFiles = {}

  for (const name in this.tests) {
    const test = this.tests[name].test
    if (test.missingFiles && test.missingFiles.length) {
      missingFiles[name] = test.missingFiles
    }
  }

  if (Object.keys(missingFiles).length) {
    console.log(
      'The following test suites had test files that were not included in their package.json:\n'.red
    )

    for (const name in missingFiles) {
      console.log(`${name}:\n\t- ${missingFiles[name].join('\n\t- ')}`.red)
    }
  }
}

TestPrinter.prototype.end = function end() {
  this.maybePrint()
  this.printVersionedMatrix()
  this.maybePrintMissing()
  clearInterval(this.interval)
}

TestPrinter.prototype._doUpdate = function _doUpdate(test, status, shouldPrint) {
  const testName = test.name
  this.tests[testName].test = test
  this.tests[testName].status = status
  this.updated = this.updated || shouldPrint

  if (status === 'error' || status === 'failure') {
    this._printError(test)
  }

  return testName
}

TestPrinter.prototype._printError = function _printError(test) {
  console.log(HR.grey)
  console.log(test.currentRun.test.red.bold, test.currentRun.packageVersions.join(' '))
  console.log('stdout'.underline)
  console.log(test.stdout)
  console.log('---------------------------------------------------------------')
  console.log('stderr'.underline)
  console.log(test.stderr)
  console.log(HR.grey)
}

/**
 * Converts the given duration into a human-readable duration string.
 *
 * @param {number} duration - The duration, in milliseconds.
 *
 * @returns {string} A human readable version of the duration.
 */
TestPrinter.prototype.niceDuration = function niceDuration(duration) {
  const seconds = 1000
  const minutes = 60 * seconds
  const hours = 60 * minutes
  const days = 24 * hours

  if (duration < 1) {
    return Math.round(duration * 1000) + '\u00B5s'
  } else if (duration > days) {
    return Math.round(duration / days) + 'd'
  } else if (duration > hours) {
    return Math.round(duration / hours) + 'h'
  } else if (duration > minutes) {
    return Math.round(duration / minutes) + 'm'
  } else if (duration > seconds) {
    return Math.round(duration / seconds) + 's'
  }
  return Math.round(duration) + 'ms'
}

/**
 * Formats the stdout for a given test suite as it is running
 * @param {string} testDir path to test
 * @returns {string} formatted string for the output of a given test iteration
 */
TestPrinter.prototype._formatTest = function _formatTest(testDir) {
  const test = this.tests[testDir].test
  let status = this.tests[testDir].status
  if (!test || !status || !test.currentRun) {
    return ('   ' + testDir).cyan
  }

  const current = test.currentRun
  let testName = path.join(testDir, path.basename(current.test))
  let result = '\u2022'.yellow // bullet
  if (status === 'done') {
    let duration = this.niceDuration(test.duration)
    if (test.duration / test.matrix.length > 15000) {
      duration = duration.red
    }

    testName = testDir.grey
    result = '\u2713'.green // checkmark

    status = `(${test.matrix.length}) ${duration}`.grey
  } else if (status === 'error' || status === 'failure') {
    result = '\u2716'.red // x mark
    testName = testName.red

    status = `run ${test.runs} of ${test.matrix.length}): ${status.red}`
  } else {
    testName = testName.grey
    status = `run ${test.runs} of ${test.matrix.length}): ${status.cyan}`
  }
  return ` ${result} ${testName} ${status}`
}

TestPrinter.prototype._isFailure = function _isFailure(status) {
  return status === 'failure' || status === 'error'
}

/* eslint-enable no-console */

module.exports = TestPrinter
