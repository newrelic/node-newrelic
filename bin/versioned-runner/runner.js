/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable no-console */

const path = require('path')
const cp = require('child_process')
// +) Exit codes greater than zero mean the test failed.
// -) Exit codes less than zero mean this script failed.
// 0) Exit codes equal to zero mean everything worked.

const CHILD_TIMEOUT_DEFAULT = 60 * 1000 // 1 minute
const CHILD_TIMEOUT = process.env.TEST_CHILD_TIMEOUT
  ? parseInt(process.env.TEST_CHILD_TIMEOUT, 10)
  : CHILD_TIMEOUT_DEFAULT
const CHILD_KILL_TIMEOUT = 10 * 1000 // 10 seconds

const packages = process.argv.slice(2)
if (!packages.length) {
  console.log('Usage: version-runner <test-file> [<package>...]')

  process.exit(-1)
}
const testFile = packages.shift()

async function main() {
  let error
  try {
    await installPackages()
    await runTests()
  } catch (err) {
    error = err
    console.error(err.message)
  } finally {
    const status = { status: 'done', error }
    process.send(status)

    process.exit(error?.code || 0)
  }
}

async function installPackages() {
  return new Promise((resolve, reject) => {
    process.once('message', async function handler() {
      process.send({ status: 'installing' })
      if (packages.length === 0) {
        resolve()
      }

      let args = [
        'install',
        '--no-save', // do not update package file
        '--no-package-lock', // do not update package-lock file
        '--no-audit', // skip audit output
        '--no-fund' // skip funding output
      ]
      args = args.concat(packages)
      try {
        await spawn('npm', args)
        resolve()
      } catch (err) {
        err.code = -Math.abs(err.code)
        reject(err)
      } finally {
        process.send({ status: 'completed' })
      }
    })
  })
}

async function runTests() {
  return new Promise((resolve, reject) => {
    process.once('message', async function handler() {
      // TODO: Add tap arguments, such as color.
      process.send({ status: 'running' })
      let args = [testFile]
      if (process.env.PKG_TYPE === 'module' && process.env.NR_LOADER) {
        const loaderPath = path.resolve(process.env.NR_LOADER)
        const loaderArg = '--experimental-loader'
        args = [loaderArg, loaderPath, testFile]
      }

      try {
        await spawn('node', args)
        resolve()
      } catch (err) {
        const error = new Error('Failed to execute test: ' + err.stack)
        error.code = Math.abs(err.code)
        reject(error)
      } finally {
        process.send({ status: 'completed' })
      }
    })
  })
}

async function spawn(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(cmd, args, {
      stdio: ['ignore', process.stdout, process.stderr, 'ipc']
    })

    let terminated = false
    let timeout = setTimeout(function sigTerm() {
      child.kill('SIGTERM')
      terminated = true
      timeout = setTimeout(function sigKill() {
        child.kill('SIGKILL')
      }, CHILD_KILL_TIMEOUT)
    }, CHILD_TIMEOUT)

    let error = null
    child.on('error', function erroHandler(err) {
      error = err
    })

    child.on('exit', function exitHandler(code, signal) {
      clearTimeout(timeout)

      if (code) {
        if (!error) {
          error = new Error('Failed to execute ' + cmd + ' ' + args.join(' '))
        }
        error.code = code
      } else if (!error && terminated) {
        error = new Error('Command timed out: ' + cmd + ' ' + args.join(' '))
        error.code = 0xbad
      }

      // https://nodejs.org/api/child_process.html#child_process_event_exit
      // If the process exited, code is the final exit code of the process,
      // otherwise null. If the process terminated due to receipt of a signal,
      // signal is the string name of the signal, otherwise null. One of the
      // two will always be non-null.
      if (code === null && !error && signal) {
        // if there's no exit code but we exited due to a received signal,
        // raise an appropriate error.
        error = new Error('Aborted with signal ' + signal + ' ' + cmd + ' ' + args.join(' '))
        error.code = 0xbad
      }

      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

main()
