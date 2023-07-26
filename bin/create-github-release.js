/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('fs')
const { program } = require('commander')

const Github = require('./github')

const DEFAULT_FILE_NAME = 'NEWS.md'
/** e.g. v7.2.1 */
const TAG_VALID_REGEX = /v\d+\.\d+\.\d+/

const SUPPORT_STATEMENT = `
### Support statement:

We recommend updating to the latest agent version as soon as it's available. If you can't upgrade to the latest version, update your agents to a version no more than 90 days old. Read more about keeping agents up to date. (https://docs.newrelic.com/docs/new-relic-solutions/new-relic-one/install-configure/update-new-relic-agent/)

See the New Relic Node.js agent EOL policy for information about agent releases and support dates. (https://docs.newrelic.com/docs/apm/agents/nodejs-agent/getting-started/nodejs-agent-eol-policy/)`

program.requiredOption('--tag <tag>', 'tag name to create GitHub release for')
program.option(
  '--repo <repo>',
  'Repo to work against(Defaults to newrelic/node-newrelic)',
  'newrelic/node-newrelic'
)
program.option(
  '--changelog <changelog>',
  'Name of changelog(defaults to NEWS.md)',
  DEFAULT_FILE_NAME
)
program.option('-f --force', 'bypass validation')

async function createRelease() {
  // Parse commandline options inputs
  program.parse()

  const options = program.opts()

  console.log('Script running with following options: ', JSON.stringify(options))
  const [owner, repo] = options.repo.split('/')

  const github = new Github(owner, repo)

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
    const body = await getReleaseNotes(tagName, options.changelog)

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

  const sections = data.split(/^### /m, 2)
  if (sections.length !== 2) {
    throw new Error('Did not split into multiple sections. Double check notes format.')
  }

  const tagSection = sections[1]
  // e.g. v7.1.2 (2021-02-24)\n\n
  const headingRegex = /^v\d+\.\d+\.\d+ \(\d{4}-\d{2}-\d{2}\)\n\n/
  const headingRemoved = tagSection.replace(headingRegex, '')

  return headingRemoved + SUPPORT_STATEMENT
}

async function readReleaseNoteFile(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', (err, data) => {
      if (err) {
        reject(err)
      }

      resolve(data)
    })
  })
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
