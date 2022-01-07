/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('fs')
const { program } = require('commander')

const Github = require('./github')
const git = require('./git-commands')

const DEFAULT_FILE_NAME = 'NEWS.md'
/** e.g. v7.2.1 */
const TAG_VALID_REGEX = /v\d+\.\d+\.\d+/

program.requiredOption('--tag <tag>', 'tag name to create GitHub release for')
program.option('--remote <remote>', 'remote to push branch to', 'origin')
program.option('--repo-owner <repoOwner>', 'repository owner', 'newrelic')
program.option(
  '--changelog <changelog>',
  'Name of changelog(defaults to NEWS.md)',
  DEFAULT_FILE_NAME
)
program.option('-f --force', 'bypass validation')
const RELEASE_NOTES_PATH = './src/content/docs/release-notes/agent-release-notes/nodejs-release-notes'

async function createRelease() {
  // Parse commandline options inputs
  program.parse()

  const options = program.opts()

  console.log('Script running with following options: ', JSON.stringify(options))


  try {
    const version = options.tag.replace('refs/tags/', '')
    console.log('Getting version from tag: ', version)

    logStep('Validation')
    if (options.force) {
      console.log('--force set. Skipping validation logic')
    }

    if (!options.force && !TAG_VALID_REGEX.exec(version)) {
      console.log('Tag arg invalid (%s). Valid tags in form: v#.#.# (e.g. v7.2.1)', version)
      stopOnError()
    }

    logStep('Get Release Notes from File')
    const { body, releaseDate } = await getReleaseNotes(version, options.changelog)
    const releaseNotesBody = [
      '---',
      'subject: Node.js agent',
      `releaseDate: '${releaseDate}'`,
      `version: ${version.substr(1)}`,
      `downloadLink: 'https://www.npmjs.com/package/newrelic'`,
      '---',
      '',
      '##Notes',
      '',
      body
    ].join('\n')


    logStep('Branch Creation')
    process.chdir('docs-website')
    const branchName = `bob-add-node-${version}`
    if (options.dryRun) {
      console.log('Dry run indicated (--dry-run), not creating branch.')
    } else {
      console.log('Creating and checking out new branch: ', branchName)
      await git.checkoutNewBranch(branchName)
    }


    logStep('Create Release Notes')
    await addReleaseNotesFile(releaseNotesBody, version)

    logStep('Commit Release Notes')

    if (options.dryRun) {
      console.log('Dry run indicated (--dry-run), skipping remaining steps.')
      return
    }

    console.log(`Adding release notes for ${version}`)
    await git.addAllFiles()
    await git.commit(`chore: Node.js Agent ${version} Release Notes.`)
    console.log(`Pushing branch to remote ${options.remote}`)
    await git.pushToRemote(options.remote, branchName)

    logStep('Create Pull Request')

    if (!process.env.GITHUB_TOKEN) {
      console.log('GITHUB_TOKEN required to create a pull request')
      stopOnError()
    }

    console.log(`Creating PR with new release for repo owner ${options.repoOwner}`)
    const github = new Github(options.repoOwner, 'docs-website')
    const title = `Node.js Agent ${version} Release Notes`
    // TODO: add proper pr body and submit then be done with it

    process.chdir('..')
    console.log('*** Full Run Successful ***')

  } catch (err) {
    if (err.status && err.status === 404) {
      console.log('404 status error detected. For octokit, this may mean insuffient permissions.')
      console.log('Ensure you have a valid GITHUB_TOKEN set in your env vars.')
    }

    stopOnError(err)
  }
}

async function getReleaseNotes(version, releaseNotesFile) {
  console.log('Retrieving release notes from file: ', releaseNotesFile)

  const data = await readReleaseNoteFile(releaseNotesFile)

  const currentVersionHeader = `### ${version}`
  if (data.indexOf(currentVersionHeader) !== 0) {
    throw new Error(`Current tag (${currentVersionHeader}) not first line of release notes.`)
  }

  const sections = data.split('### ', 2)
  if (sections.length !== 2) {
    throw new Error('Did not split into multiple sections. Double check notes format.')
  }

  const [ , tagSection] = sections
  // e.g. v7.1.2 (2021-02-24)\n\n
  const headingRegex = /^v\d+\.\d+\.\d+ \((\d{4}-\d{2}-\d{2})\)\n\n/
  const body = tagSection.replace(headingRegex, '')
  const [ , releaseDate] = headingRegex.exec(tagSection)

  return { body, releaseDate }
}

async function readReleaseNoteFile(file) {
  const promise = new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', (err, data) => {
      if (err) {
        return reject(err)
      }

      return resolve(data)
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

function addReleaseNotesFile(body, version) {
  const FILE = `node-agent-bob-${version}.mdx`
  return new Promise((resolve, reject) => {
    fs.writeFile(`${RELEASE_NOTES_PATH}/${FILE}`, body, 'utf8', (writeErr) => {
      if(writeErr) {
        reject(err)
      }

      console.log(`Added new release notes ${FILE} to ${RELEASE_NOTES_PATH}`)
      resolve()
    })
  })
}

createRelease()
