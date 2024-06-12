/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { program } = require('commander')

const Github = require('./github')
const git = require('./git-commands')

const DEFAULT_FILE_NAME = 'NEWS.md'
/** e.g. v7.2.1 */
const TAG_VALID_REGEX = /v\d+\.\d+\.\d+/
const BASE_BRANCH = 'develop'

let GITHUB_USER
let GITHUB_EMAIL

program.requiredOption('--tag <tag>', 'tag name to get version of released agent')
program.option('--remote <remote>', 'remote to push branch to', 'origin')
program.option('--username <github username>', 'Owner of the fork of docs-website')
program.option('--email <github email>', 'Email of the fork owner')
program.option(
  '--changelog <changelog>',
  'Name of changelog(defaults to NEWS.md)',
  DEFAULT_FILE_NAME
)
program.option('--dry-run', 'executes script but does not commit nor create PR')
program.option(
  '--repo-path <path',
  'Path to the docs-website fork on local machine',
  '/tmp/docs-website'
)
program.option(
  '--front-matter-file <json file>',
  'Name of changelog(defaults to changelog.json)',
  'changelog.json'
)

program.option('--repo-owner <owner>', 'Owner of the target repo', 'newrelic')

const RELEASE_NOTES_PATH =
  './src/content/docs/release-notes/agent-release-notes/nodejs-release-notes'

const SUPPORT_STATEMENT = `
### Support statement:

We recommend updating to the latest agent version as soon as it's available. If you can't upgrade to the latest version, update your agents to a version no more than 90 days old. Read more about keeping agents up to date. (https://docs.newrelic.com/docs/new-relic-solutions/new-relic-one/install-configure/update-new-relic-agent/)

See the New Relic Node.js agent EOL policy for information about agent releases and support dates. (https://docs.newrelic.com/docs/apm/agents/nodejs-agent/getting-started/nodejs-agent-eol-policy/)`

async function createReleaseNotesPr() {
  // Parse commandline options inputs
  program.parse()

  const options = program.opts()

  console.log(`Script running with following options: ${JSON.stringify(options)}`)

  GITHUB_USER = options.username || process.env.GITHUB_USER || process.env.GITHUB_ACTOR
  GITHUB_EMAIL = options.email || process.env.GITHUB_EMAIL || `gh-actions-${GITHUB_USER}@github.com`
  const repoOwner = options.repoOwner

  try {
    const version = options.tag.replace('refs/tags/', '')
    console.log(`Getting version from tag: ${version}`)

    logStep('Validation')
    validateTag(version, options.force)
    logStep('Get Release Notes from File')
    const { body, releaseDate } = await getReleaseNotes(version, options.changelog)
    const frontmatter = await getFrontMatter(version, options.frontMatterFile)

    if (!fs.existsSync(options.repoPath)) {
      logStep('Clone docs repo')
      await cloneDocsRepo(options.repoPath, repoOwner)
    }

    logStep('Branch Creation')
    const branchName = await createBranch(options.repoPath, version, options.dryRun)
    logStep('Format release notes file')
    const releaseNotesBody = formatReleaseNotes(releaseDate, version, body, frontmatter)
    logStep('Create Release Notes')
    await addReleaseNotesFile(releaseNotesBody, version)
    logStep('Commit Release Notes')
    await commitReleaseNotes(version, options.remote, branchName, options.dryRun)
    logStep('Create Pull Request')
    await createPR(version, branchName, options.dryRun, repoOwner)
    console.log('*** Full Run Successful ***')
  } catch (err) {
    if (err.status && err.status === 404) {
      console.log('404 status error detected. For octokit, this may mean insufficient permissions.')
      console.log('Ensure you have a valid GITHUB_TOKEN set in your env vars.')
    }

    stopOnError(err)
  } finally {
    process.chdir('..')
  }
}

/**
 * Validates tag matches version we want vX.X.X
 *
 * @param {string} version string to validate
 * @param {boolean} force flag to skip validation of tag
 */
function validateTag(version, force) {
  if (force) {
    console.log('--force set. Skipping validation logic')
    return
  }

  if (!TAG_VALID_REGEX.exec(version)) {
    console.log('Tag arg invalid (%s). Valid tags in form: v#.#.# (e.g. v7.2.1)', version)
    stopOnError()
  }
}

/**
 * Extracts the relevant changes from the NEWS.md
 *
 * @param {string} version the new version
 * @param {string} releaseNotesFile the filename where the release notes are stored
 */
async function getReleaseNotes(version, releaseNotesFile) {
  console.log('Retrieving release notes from file: ', releaseNotesFile)

  const data = await readReleaseNoteFile(releaseNotesFile)

  const sections = data.split(/^### /m)
  // Iterate over all past releases to find the version we want
  const versionChangeLog = sections.find((section) => section.startsWith(version))
  // e.g. v7.1.2 (2021-02-24)\n\n
  const headingRegex = /^v\d+\.\d+\.\d+ \((\d{4}-\d{2}-\d{2})\)\s+/
  const body = versionChangeLog.replace(headingRegex, '') + SUPPORT_STATEMENT
  const [, releaseDate] = headingRegex.exec(versionChangeLog)

  return { body, releaseDate }
}

/**
 * Pulls the necessary frontmatter content for the given version
 * from our JSON based changelog
 *
 * @param {string} tagName version tag name
 * @param {string} frontMatterFile JSON changelog file
 * @returns {object} frontmatter hash containing security, bugfix and feature lists
 */
async function getFrontMatter(tagName, frontMatterFile) {
  console.log(`Retrieving release notes from file: ${frontMatterFile}`)

  const version = tagName.replace('v', '')
  const data = await readReleaseNoteFile(frontMatterFile)
  const changelog = JSON.parse(data)
  const frontmatter = changelog.entries.find((entry) => entry.version === version)

  if (!frontmatter) {
    throw new Error(`Unable to find ${version} entry in ${frontMatterFile}`)
  }

  return {
    security: JSON.stringify(frontmatter.changes.security),
    bugfixes: JSON.stringify(frontmatter.changes.bugfixes),
    features: JSON.stringify(frontmatter.changes.features)
  }
}

/**
 * Reads the contents of NEWS.md
 *
 * @param {string} file path to NEWS.md
 */
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

/**
 * Clones docs repo
 *
 * @param {string} repoPath where to checkout the repo
 * @param {string} repoOwner Github organization/owner name
 * @returns {boolean} success or failure
 */
async function cloneDocsRepo(repoPath, repoOwner) {
  const branch = 'develop'
  const url = `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${repoOwner}/docs-website.git`
  const cloneOptions = [`--branch=${branch}`, '--single-branch']

  return git.clone(url, repoPath, cloneOptions)
}

/**
 * Creates a branch in your local `docs-website` fork
 * That follows the pattern `add-node-<new agent version>`
 *
 * @param {string} filePath path to the `docs-website` fork
 * @param {string} version newest version of agent
 * @param {boolean} dryRun skip branch creation
 */
async function createBranch(filePath, version, dryRun) {
  filePath = path.resolve(filePath)
  console.log(`Changing to ${filePath}`)
  process.chdir(filePath)
  const branchName = `add-node-${version}`
  if (dryRun) {
    console.log(`Dry run indicated (--dry-run), not creating branch ${branchName}`)
  } else {
    console.log('Creating and checking out new branch: ', branchName)
    await git.checkout(BASE_BRANCH)
    await git.checkoutNewBranch(branchName)
  }

  return branchName
}

/**
 * Formats the .mdx to adhere to the docs team standards for
 * release notes.
 *
 * @param {string} releaseDate date the release was created
 * @param {string} version version number
 * @param {string} body list of changes
 * @param {object} frontmatter agent version metadata information about the release
 * @returns {string} appropriately formatted release notes
 */
function formatReleaseNotes(releaseDate, version, body, frontmatter) {
  const releaseNotesBody = [
    '---',
    'subject: Node.js agent',
    `releaseDate: '${releaseDate}'`,
    `version: ${version.substring(1)}`, // remove the `v` from start of version
    `downloadLink: 'https://www.npmjs.com/package/newrelic'`,
    `security: ${frontmatter.security}`,
    `bugs: ${frontmatter.bugfixes}`,
    `features: ${frontmatter.features}`,
    '---',
    '',
    '## Notes',
    '',
    body
  ].join('\n')

  console.log(`Release Notes Body \n${releaseNotesBody}`)
  return releaseNotesBody
}

/**
 * Writes the contents of the release notes to the docs-website fork
 *
 * @param {string} body contents of the .mdx
 * @param {string} version version number
 */
function addReleaseNotesFile(body, version) {
  const FILE = getFileName(version)
  return new Promise((resolve, reject) => {
    fs.writeFile(FILE, body, 'utf8', (writeErr) => {
      if (writeErr) {
        reject(writeErr)
      }

      console.log(`Added new release notes ${FILE}`)
      resolve()
    })
  })
}

function getFileName(version) {
  // change `v0.0.0` to `0-0-0`
  version = version.substring(1).replace(/\./g, '-')
  const FILE = `node-agent-${version}.mdx`
  return `${RELEASE_NOTES_PATH}/${FILE}`
}

/**
 * Commits release notes to the local fork and pushes to proper branch.
 *
 * @param {string} version version number
 * @param {string} remote github remote
 * @param {string} branch github branch
 * @param {boolean} dryRun whether or not we should actually update the repo
 */
async function commitReleaseNotes(version, remote, branch, dryRun) {
  if (dryRun) {
    console.log('Dry run indicated (--dry-run), skipping committing release notes.')
    return
  }

  await git.setUser(GITHUB_USER, GITHUB_EMAIL)

  console.log(`Adding release notes for ${version}`)
  const files = [getFileName(version)]
  await git.addFiles(files)
  await git.commit(`chore: Adds Node.js agent ${version} release notes.`)
  console.log(`Pushing branch to remote ${remote}`)
  await git.pushToRemote(remote, branch)
}

/**
 * Creates a PR to the newrelic/docs-website with new release notes
 *
 * @param {string} version version number
 * @param {string} branch github branch
 * @param {boolean} dryRun whether or not we should actually create the PR
 * @param {string} repoOwner Owner of the docs-website repo, if targeting a fork instead of newrelic
 */
async function createPR(version, branch, dryRun, repoOwner) {
  if (!process.env.GITHUB_TOKEN) {
    console.log('GITHUB_TOKEN required to create a pull request')
    stopOnError()
  }

  const github = new Github(repoOwner, 'docs-website')
  const title = `chore: add Node.js Agent ${version} Release Notes`
  const head = repoOwner === `newrelic` ? branch : `${repoOwner}:${branch}`
  const body =
    'This is an automated PR generated when the Node.js agent is released. Please merge as soon as possible.'

  const prOptions = {
    head,
    base: BASE_BRANCH,
    title,
    body
  }

  console.log(`Creating PR with following options: ${JSON.stringify(prOptions)}\n\n`)

  if (dryRun) {
    console.log('Dry run indicated (--dry-run), skipping creating pull request.')
    return
  }

  return await github.createPR(prOptions)
}

/**
 * Logs error and exits script on failure
 *
 * @param {Error} err If present, an error that occurred during script execution
 */
function stopOnError(err) {
  if (err) {
    console.error(err)
  }

  console.log('Halting execution with exit code: 1')
  process.exit(1)
}

/**
 * Logs formatted msg
 *
 * @param {string} step the current step of the script
 */
function logStep(step) {
  console.log(`\n ----- [Step]: ${step} -----\n`)
}

/*
 * Exports slightly differ for tests vs. Github Actions
 * this allows us to require the function without it executing for tests,
 * and executing via `node` cli in GHA
 */
if (require.main === module) {
  createReleaseNotesPr()
} else {
  module.exports = {
    getReleaseNotes,
    getFrontMatter,
    formatReleaseNotes
  }
}
