'use strict'

/**
 * Executed as a part of the "version" step of npm version.
 * Updates the placeholder release note header with the incremented version
 * from running npm version
 */

const fs = require('fs')
const packageInfo = require('../package.json')

const FILE_NAME = 'NEWS.md'
const NEXT_VERSION_HEADER = '### vNext (TBD):'

const SUCCESS_MSG = '*** [SUCCESS] ***'
const FAIL_MSG = '! [FAILURE] !'

updateChangelogVersion()

async function updateChangelogVersion() {
  try {
    await updateHeader(FILE_NAME)

    console.log(SUCCESS_MSG)
  } catch (err) {
    console.log(FAIL_MSG)
    console.error(err)

    process.exit(1)
  }
}

function updateHeader(file) {
  const promise = new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', (err, data) => {
      if (err) {
        return reject(err)
      }

      // toISOString() will always return UTC time
      const todayFormatted = new Date().toISOString().split('T')[0]
      const version = `v${packageInfo.version}`
      const newChangelogHeader = `### ${version} (${todayFormatted})`

      console.log('Updating vNext header to: ', newChangelogHeader)

      if (!data.startsWith(NEXT_VERSION_HEADER)) {
        const err = new Error(`Failed to find next version header in form: '${NEXT_VERSION_HEADER}'`)
        return reject(err)
      }

      const modified = data.replace(
        NEXT_VERSION_HEADER,
        newChangelogHeader
      )

      fs.writeFile(file, modified, 'utf8', (err) => {
        if (err) {
          return reject (err)
        }

        console.log(SUCCESS_MSG)
      })
    })
  })

  return promise
}
