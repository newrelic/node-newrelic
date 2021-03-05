'use strict'

const fs = require('fs')
const {program} = require('commander')

const Github = require('./github')
const { indexOf } = require('benchmark')

const DEFAULT_FILE_NAME = 'NEWS.md'
/** e.g. v7.2.1 */
const TAG_VALID_REGEX = /v\d+\.\d+\.\d+/

program.requiredOption('--tag <tag>', 'tag name to create GitHub release for')
program.option('--repo-owner <repoOwner>', 'repository owner', 'newrelic')
program.option('--release-notes-file <releaseNotesFile>', 'path to release notes file', DEFAULT_FILE_NAME)
program.option('-f --force', 'bypass validation')

async function createRelease() {
  // Parse commandline options inputs
  program.parse()

  const options = program.opts()

  console.log('Script running with following options: ', JSON.stringify(options))

  const github = new Github(options.repoOwner)

  try {
    const tagName = options.tag.replace('refs/tags/', '')
    console.log('Using tag name: ', tagName)

    logStep('Validation')
    if (options.force) {
      console.log('--force set. Skipping validation logic')
    }

    if (!options.force && !TAG_VALID_REGEX.exec(tagName)) {
      console.log('Tag arg invalid (%s). Valid tags in form: v#.#.# (e.g. v7.2.1)', tagName)
      stopOnError()
    }

    logStep('Get Release Notes from File')
    const body = await getReleaseNotes(tagName, options.releaseNotesFile)

    logStep('Create Release')
    await github.createRelease(tagName, tagName, body)

    console.log('*** Full Run Successful ***')
  } catch (err) {
    if (err.status && err.status === 404) {
      console.log('404 status error detected. For octokit, this may mean insuffient permissions.')
      console.log('Ensure you have a valid GITHUB_TOKEN set in your env vars.')
    }

    stopOnError(err)
  }
}

async function getReleaseNotes(tagName, releaseNotesFile) {
  console.log('Retrieving release notes from file: ', releaseNotesFile)

  const data = await readReleaseNoteFile(releaseNotesFile)

  const currentVersionHeader = `### ${tagName}`
  if (data.indexOf(currentVersionHeader) !== 0) {
    throw new Error(`Current tag (${currentVersionHeader}) not first line of release notes.`)
  }

  const sections = data.split('### ', 2)
  if (sections.length !== 2) {
    throw new Error('Did not split into multiple sections. Double check notes format.')
  }

  const tagSection = sections[1]
  // e.g. v7.1.2 (2021-02-24)\n\n
  const headingRegex = /^v\d+\.\d+\.\d+ \(\d{4}-\d{2}-\d{2}\)\n\n/
  const headingRemoved = tagSection.replace(headingRegex, '')

  return headingRemoved
}

async function readReleaseNoteFile(file) {
  const promise = new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', function (err, data) {
      if (err) {
        return reject(err)
      }

      resolve(data)
    })
  })

  return promise
}

function stopOnError(err) {
  if (err) {
    console.error(err)
  }

  console.log('Halting execution with exit code: 1')
  process.exit(1)
}

function logStep(step) {
  console.log(`\n ----- [Step]: ${step} -----\n`)
}

createRelease()
