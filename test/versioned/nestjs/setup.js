/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { promisify } = require('node:util')
const exec = promisify(require('node:child_process').exec)
const fsPromises = require('node:fs/promises')
const fs = require('node:fs')

const APP_DIR = `${__dirname}/test-app`
const PATCH_DIR = `${__dirname}/test-app-replacements`

async function initNestApp() {
  if (fs.existsSync(APP_DIR)) {
    // The `nest new` command will complain if the path already exists
    // and is modified, so let's just throw it out. The tests are
    // supposed to clean this up anyway, but sometimes the tests error
    // out so badly that they can't clean up.
    await deleteNestApp()
  }
  await exec('npx nest new --package-manager npm --skip-git test-app')
  // We patch the default Nest app with some of our own functions.
  for (const fname of ['main.ts', 'app.controller.ts']) {
    await fsPromises.copyFile(`${PATCH_DIR}/${fname}`, `${APP_DIR}/src/${fname}`)
  }
  // Turn the typescript into commmonjs, so we can instrument it with
  // the mocked agent.
  await exec('npx nest build', { cwd: APP_DIR })
}

async function deleteNestApp() {
  await fsPromises.rm(APP_DIR, { recursive: true })
}

module.exports = {
  initNestApp,
  deleteNestApp
}
