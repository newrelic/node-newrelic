'use strict'

const { exec } = require('child_process')

async function version(typeOrVersion, shouldCommitAndTag) {
  let command = `npm version ${typeOrVersion}`

  command += shouldCommitAndTag ? '' : ' --no-git-tag-version'

  await execAsPromise(command)
}

function execAsPromise(command) {
  const promise = new Promise((resolve, reject) => {
    console.log(`Executing: '${command}'`)

    exec(command, (err, stdout) => {
      if (err) {
        return reject(err)
      }

      resolve(stdout)
    })
  })

  return promise
}

module.exports = {
  version
}
