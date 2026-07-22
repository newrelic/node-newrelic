#! /usr/bin/env node
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable no-console */

require('colors')

const { Command } = require('commander')
const path = require('path')
const os = require('os')

const printers = require('./versioned-runner/printers')
const Suite = require('./versioned-runner/suite')
const { buildGlobs, resolveGlobs } = require('./versioned-runner/globber')

const program = new Command()

program
  .arguments('[test-globs...]')
  .option('-j, --jobs <n>', 'Max parallel test executions. Defaults to max available CPUs.', int)
  .option('-p, --print <mode>', 'Specify print mode [pretty]', printMode, 'pretty')
  .option('-s, --skip <keyword>[,<keyword>]', 'Skip files containing the supplied keyword(s)')
  .option(
    '-P, --pattern <keyword>[,<keyword>]',
    'Only execute tests containing the supplied keyword(s).'
  )
  .option('--major', 'Only iterate on major versions of packages.')
  .option('--minor', 'Iterate over minor versions of packages (default).')
  .option('--patch', 'Iterate over every patch version of packages.')
  .option('--samples <n>', 'Global samples setting to override what is in tests package', int)
  .option('--strict', 'Throw an error if there are test files that are not being run')
  .option('-m, --matrix-count', 'Compute the test matrix and only output the count of tests to be run')
  .action(async (testGlobs, cmd) => {
    const skip = cmd.skip ? cmd.skip.split(',') : []
    const patterns = cmd.pattern ? cmd.pattern.split(',') : []
    const globs = buildGlobs(testGlobs, patterns)
    console.log('Finding tests in %d globs'.yellow, globs.length)
    let files
    try {
      files = await resolveGlobs(globs, skip)
    } catch (err) {
      console.error('Error globbing:', err)
      process.exit(2)
    } finally {
      if (!files || !files.length) {
        console.error('No files matched', globs)
        process.exit(0)
      } else {
        await run(files, patterns, cmd)
      }
    }
  })

if (require.main === module) {
  program.parse(process.argv) // runs the action handler
} else {
  module.exports = { int, printMode, run }
}

function int(val) {
  return parseInt(val, 10)
}

function printMode(mode) {
  if (['pretty', 'simple', 'quiet'].indexOf(mode) === -1) {
    console.error('Invalid print mode "' + mode + '"')
    process.exit(5)
  }
  return mode
}

async function run(files, patterns, cmd) {
  let maxParallelRuns = cmd.jobs
  if (!maxParallelRuns) {
    maxParallelRuns = os.cpus().length
    console.log(`Defaulting to max parallel runs of: ${maxParallelRuns} based on avaiable CPUs.`)
  }

  // Clean up the files we'll be running.
  const filePaths = new Set()
  files.sort().forEach((file) => {
    filePaths.add(path.resolve(file))
  })

  let directories = new Set()
  filePaths.forEach((filePath) => {
    directories.add(path.dirname(filePath))
  })
  directories = Array.from(directories)

  let mode = 'minor'
  if (cmd.major) {
    mode = 'major'
  } else if (cmd.patch) {
    mode = 'patch'
  }

  // Create our test structures.
  let viewer
  switch (cmd.print) {
    case 'default':
    case 'simple': {
      viewer = new printers.SimplePrinter(files, { refresh: 100 })
      break
    }

    case 'pretty': {
      viewer = new printers.PrettyPrinter(files, { refresh: 100 })
      break
    }

    case 'quiet': {
      viewer = new printers.QuietPrinter(files, { refresh: 100 })
      break
    }
  }

  const runner = new Suite(directories, {
    limit: maxParallelRuns,
    versions: mode,
    testPatterns: patterns,
    globalSamples: cmd.samples,
    strict: !!cmd.strict,
    matrixCountOnly: cmd.matrixCount ?? false
  })
  runner.on('update', viewer.update.bind(viewer))
  runner.on('end', viewer.end.bind(viewer))

  const matrixTable = {
    total: 0,
    rows: {}
  }
  console.log('Finding all versions for a package'.yellow)
  runner.on('packageResolved', (pkg, versions) => {
    matrixTable.total += versions.length
    matrixTable.rows[pkg] = versions.length
    console.log(`${pkg}(${versions.length})`)
  })

  runner.on('matrixCountReady', () => {
    const sortedRows = []

    const keys = Object.keys(matrixTable.rows).sort()
    let width = 0
    for (const key of keys) {
      if (key.length > width) {
        width = key.length
      }
      sortedRows.push([key, matrixTable.rows[key]])
    }

    let lastRow
    console.log('\n\nModule Test Versions Counts')
    for (const row of sortedRows) {
      lastRow = `${row[0].padEnd(width)} ${row[1].toLocaleString('en-US')}`
      console.log(lastRow)
    }
    console.log('-'.repeat(lastRow.length))

    console.log('total:'.padEnd(width), matrixTable.total.toLocaleString('en-US'))

    process.exit(0)
  })

  // Off to the races!
  try {
    await runner.start()
  } catch (err) {
    if (runner.listenerCount('error')) {
      runner.emit('error', err)
    }

    console.log('ERROR'.bold.red)
    console.error(err)
    process.exit(3)
  }

  if (runner.failures.length) {
    console.log('FAIL'.bold.red + ' (' + runner.failures.length + ')')
    runner.failures.forEach((test) => {
      console.log(
        `   packages: ${test.currentRun.packageVersions.join(', ').grey} file: ${
          test.currentRun.test.red
        }`
      )
    })
    process.exit(4)
  } else {
    const missingFiles = runner.tests.filter((test) => test.missingFiles.length)
    if (missingFiles.length && runner.opts.strict) {
      console.log('FAIL'.bold.red)
      process.exit(1)
    }
    console.log('PASS'.bold.green)
  }
}

