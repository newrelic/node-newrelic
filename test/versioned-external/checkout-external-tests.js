/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { rm, mkdir } = require('fs/promises')

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
  await rm(TEMP_TESTS_FOLDER, { recursive: true, force: true })
  await mkdir(TEMP_TESTS_FOLDER)
}

checkoutTests()
