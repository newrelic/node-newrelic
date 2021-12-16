/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/* eslint-disable no-console, no-process-exit */

// TODO: Update when drop Node 12
// 'rm' not available in Node 12 but considered deprecated in newer versions
// 'fs/promises' not available in Node 12
const { existsSync } = require('fs')
const { rmdir, mkdir } = require('fs').promises

const { sparseCloneRepo } = require('../../bin/git-commands')
const repos = require('./external-repos')

const TEMP_TESTS_FOLDER = 'TEMP_TESTS'

const CHECKOUT_FOLDERS = ['lib', 'tests/versioned']

async function checkoutTests() {
  // Run in context of the folder this script lives in
  process.chdir(__dirname)

  await createNewTestFolder()

  process.chdir(`./${TEMP_TESTS_FOLDER}`)

  for await (const item of repos) {
    const additionalFiles = item.additionalFiles || []
    const checkoutFiles = [...additionalFiles, ...CHECKOUT_FOLDERS]

    await sparseCloneRepo(item, checkoutFiles)
  }
}

async function createNewTestFolder() {
  if (existsSync(TEMP_TESTS_FOLDER)) {
    console.log(`Removing ${TEMP_TESTS_FOLDER} folder.`)
    await rmdir(TEMP_TESTS_FOLDER, { recursive: true, force: true })
  }

  console.log(`Creating new ${TEMP_TESTS_FOLDER} folder.`)
  await mkdir(TEMP_TESTS_FOLDER)
}

try {
  checkoutTests()
} catch (error) {
  stopOnError(error)
}

function stopOnError(err) {
  if (err) {
    console.error(err)
  }

  console.log('Halting execution with exit code: 1')
  process.exit(1)
}

/* eslint-enable no-console, no-process-exit */
