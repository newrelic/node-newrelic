/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { exec } = require('child_process')

async function version(typeOrVersion, shouldCommitAndTag) {
  let command = `npm version ${typeOrVersion}`

  command += shouldCommitAndTag ? '' : ' --no-git-tag-version'

  await execAsPromise(command)
}

function execAsPromise(command) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: '${command}'`)

    // eslint-disable-next-line sonarjs/os-command
    exec(command, (err, stdout) => {
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
