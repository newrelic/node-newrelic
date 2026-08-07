/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { execFile } = require('child_process')

async function version(typeOrVersion, shouldCommitAndTag) {
  const args = ['version', typeOrVersion]

  if (!shouldCommitAndTag) {
    args.push('--no-git-tag-version')
  }

  await execAsPromise(args)
}

function execAsPromise(args) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: 'npm ${args.join(' ')}'`)

    execFile('npm', args, (err, stdout) => {
      if (err) {
        return reject(err)
      }

      return resolve(stdout)
    })
  })
}

module.exports = {
  version
}
