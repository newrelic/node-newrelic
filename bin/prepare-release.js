/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('fs')

const { program, Option } = require('commander')

const Github = require('./github')
const ConventionalChangelog = require('./conventional-changelog')
const git = require('./git-commands')
const npm = require('./npm-commands')

const PROPOSED_NOTES_HEADER = 'Proposed Release Notes'
const FORCE_RUN_DEFAULT_REMOTE = 'origin'

// Add command line options
program.addOption(
  new Option('--release-type <releaseType>', 'release type')
    .choices(['patch', 'minor', 'major'])
    .makeOptionMandatory()
)
program.option(
  '--major-release',
  "create a major release. (release-type option must be set to 'major')"
)
program.option('--remote <remote>', 'remote to push branch to', 'origin')
program.option('--branch <branch>', 'branch to generate notes from', 'main')
program.option('--dry-run', 'generate notes without creating a branch or PR')
program.option('--no-pr', 'generate notes and branch but do not create PR')
program.option('-f --force', 'bypass validation')
program.option('--changelog <changelog>', 'Name of changelog(defaults to NEWS.md)', 'NEWS.md')
program.option(
  '--repo <repo>',
  'Repo to work against(Defaults to newrelic/node-newrelic)',
  'newrelic/node-newrelic'
)
program.option('--use-new-release', 'use new conventional commit release note process')
program.option(
  '--changelog-json',
  'generate notes with a corresponding changelog.json(only for node-newrelic)'
)

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

async function isValid(options) {
  if (options.force) {
    console.log('--force set. Skipping validation logic')
    return true
  }
  const startingBranch = options.branch.replace('refs/heads/', '')
  return (
    (await validateRemote(options.remote)) &&
    (await validateLocalChanges()) &&
    (await validateCurrentBranch(startingBranch))
  )
}

async function prepareReleaseNotes() {
  // Parse commandline options inputs
  program.parse()
  const options = program.opts()
  console.log('Script running with following options: ', JSON.stringify(options))
  const [owner, repo] = options.repo.split('/')

  logStep('Validation')

  if (!(await isValid(options))) {
    console.log('Invalid configuration. Halting script.')
    stopOnError()
  }

  const remote = options.remote || FORCE_RUN_DEFAULT_REMOTE
  console.log('Using remote: ', remote)

  try {
    logStep('Increment Version')

    await npm.version(options.releaseType, false)

    const packagePath = `${process.cwd()}/package.json`
    console.log(`Extracting new version from ${packagePath}`)
    const packageInfo = require(packagePath)

    const version = `v${packageInfo.version}`
    console.log('New version is: ', version)

    logStep('Branch Creation')

    const newBranchName = `release/${version}`

    if (options.dryRun) {
      console.log('Dry run indicated (--dry-run), not creating branch.')
    } else {
      console.log('Creating and checking out new branch: ', newBranchName)
      await git.checkoutNewBranch(newBranchName)
    }

    logStep('Commit Package Files')

    if (options.dryRun) {
      console.log('Dry run indicated (--dry-run), not committing package files.')
    } else {
      console.log('Adding and committing package files.')
      await git.addAllFiles()
      await git.commit(`Setting version to ${version}.`)
    }

    let releaseData
    if (options.useNewRelease) {
      logStep('Create Release Notes - Conventional Commit based')
      const [markdown] = await generateConventionalReleaseNotes({
        owner,
        repo,
        newVersion: packageInfo.version,
        markdownChangelog: options.changelog,
        generateJsonChangelog: options.changelogJson
      })
      releaseData = markdown
    } else {
      logStep('Create Release Notes')
      releaseData = await generateReleaseNotes(owner, repo)
      await updateReleaseNotesFile(options.changelog, version, releaseData.notes)
    }

    if (options.dryRun) {
      console.log('\nDry run indicated (--dry-run), skipping remaining steps.')
      return
    }

    logStep('Commit Release Notes')

    console.log('Adding and committing release notes.')
    await git.addAllFiles()
    await git.commit('Adds auto-generated release notes.')

    logStep('Push Branch')

    console.log('Pushing branch to remote: ', remote)
    await git.pushToRemote(remote, newBranchName)

    logStep('Create Pull Request')
    if (!options.pr) {
      console.log('No PR creation indicated (--no-pr), skipping remaining steps.')
      return
    }

    if (!process.env.GITHUB_TOKEN) {
      console.log('GITHUB_TOKEN required to create a pull request (PR)')
      stopOnError()
    }

    console.log('Creating draft PR with new release notes for repo owner: ', owner)
    const remoteApi = new Github(owner, repo)

    let title
    let body

    if (options.useNewRelease) {
      title = `chore: release ${version}`
      body = releaseData
    } else {
      title = `Release ${version}`
      body = getFormattedPrBody(releaseData)
    }

    const prOptions = {
      head: newBranchName,
      base: 'main',
      title,
      body,
      draft: true
    }

    await remoteApi.createPR(prOptions)

    console.log('*** Full Run Successful ***')
  } catch (err) {
    stopOnError(err)
  }
}

async function validateRemote(remote) {
  try {
    const remotes = await git.getPushRemotes()

    if (!remote) {
      console.log('No remote configured. Please execute with --remote.')
      console.log('Available remotes are: ', remotes)
      return false
    }

    if (!remotes[remote]) {
      console.log(`Configured remote (${remote}) not found in ${JSON.stringify(remotes)}`)
      return false
    }

    return true
  } catch (err) {
    console.error(err)
    return false
  }
}

async function validateLocalChanges() {
  try {
    const localChanges = await git.getLocalChanges()
    if (localChanges.length > 0) {
      console.log('Local changes detected: ', localChanges)
      console.log('Please commit to a feature branch or stash changes and then try again.')
      return false
    }

    return true
  } catch (err) {
    console.error(err)
    return false
  }
}

async function validateCurrentBranch(branch) {
  try {
    const currentBranch = await git.getCurrentBranch()

    if (branch !== currentBranch) {
      console.log(
        'Current checked-out branch (%s) does not match expected (%s)',
        currentBranch,
        branch
      )
      return false
    }

    return true
  } catch (err) {
    console.error(err)
    return false
  }
}

async function generateReleaseNotes(owner, repo) {
  const github = new Github(owner, repo)
  const latestRelease = await github.getLatestRelease()
  console.log(
    `The latest release is: ${latestRelease.name} published: ${latestRelease.published_at}`
  )
  console.log(`Tag: ${latestRelease.tag_name}, Target: ${latestRelease.target_commitish}`)

  const tag = await github.getTagByName(latestRelease.tag_name)
  console.log('The tag commit sha is: ', tag.commit.sha)

  const commit = await github.getCommit(tag.commit.sha)
  const commitDate = commit.commit.committer.date

  console.log(`Finding merged pull requests since: ${commitDate}`)

  const mergedPullRequests = await github.getMergedPullRequestsSince(commitDate)

  const filteredPullRequests = mergedPullRequests.filter((pr) => {
    // Sometimes the commit for the PR the tag is set to has an earlier time than
    // the PR merge time and we'll pull in release note PRs. Filters those out.

    return pr.merge_commit_sha !== tag.commit.sha
  })

  console.log(`Found ${filteredPullRequests.length}`)

  const releaseNoteData = filteredPullRequests.map((pr) => {
    const parts = pr.body.split(/(?:^|\n)##\s*/g)

    // If only has one part, not in appropriate format.
    if (parts.length === 1) {
      return {
        notes: generateUnformattedNotes(pr.body),
        url: pr.html_url
      }
    }

    const { 1: proposedReleaseNotes } = parts

    const titleRemoved = proposedReleaseNotes.replace(PROPOSED_NOTES_HEADER, '')
    return {
      notes: titleRemoved,
      url: pr.html_url
    }
  })

  return releaseNoteData.reduce(
    (result, currentValue) => {
      const trimmedNotes = currentValue.notes.trim()
      if (trimmedNotes) {
        // avoid adding lines for empty notes
        result.notes += '\n\n' + trimmedNotes
      }
      result.links += `\n* PR: ${currentValue.url}`
      return result
    },
    {
      notes: '',
      links: ''
    }
  )
}

/**
 * Function for generating and writing our release notes based on Conventional Commits
 *
 * @param {object} params function params
 * @param {string} params.owner github repo org
 * @param {string} params.repo github repo name
 * @param {string} params.newVersion version to be published
 * @param {string} params.markdownChangelog filepath of markdown changelog
 * @param {boolean} params.generateJsonChangelog indicator if it should update changelog.json
 * @returns {object[]} generate data of markdown and json
 */
async function generateConventionalReleaseNotes({
  owner,
  repo,
  newVersion,
  markdownChangelog,
  generateJsonChangelog
}) {
  const github = new Github(owner, repo)
  const latestRelease = await github.getLatestRelease()

  const changelog = new ConventionalChangelog({
    org: owner,
    repo,
    newVersion,
    previousVersion: latestRelease.tag_name.replace('v', '')
  })

  const commits = await changelog.getFormattedCommits()

  const markdown = await changelog.generateMarkdownChangelog(commits)
  await changelog.writeMarkdownChangelog(markdown, markdownChangelog)

  let json = null
  if (generateJsonChangelog) {
    json = await changelog.generateJsonChangelog(commits)
    await changelog.writeJsonChangelog(json)
  }

  return [markdown, json]
}

function generateUnformattedNotes(originalNotes) {
  let unformattedNotes = originalNotes

  // Drop extra snyk details and just keep high-level summary.
  if (originalNotes.indexOf('snyk:metadata') >= 0) {
    const snykParts = originalNotes.split('<hr/>')
    const { 0: snykDescription } = snykParts

    unformattedNotes = snykDescription.trim()
  }

  return ['--- NOTES NEEDS REVIEW ---', unformattedNotes, '--------------------------'].join('\n')
}

function updateReleaseNotesFile(file, version, newNotes) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', (err, data) => {
      if (err) {
        reject(err)
      }

      if (data.startsWith(`### ${version}`)) {
        const errMessage = [
          `${file} already contains '${version}'`,
          `Delete existing ${version} release notes (if desired) and run again`
        ].join('\n')

        reject(new Error(errMessage))
      }

      const todayFormatted = getReleaseDate()
      const newVersionHeader = `### ${version} (${todayFormatted})`

      const newContent = [newVersionHeader, newNotes, '\n\n', data].join('')

      fs.writeFile(file, newContent, 'utf8', (writeErr) => {
        if (writeErr) {
          reject(err)
        }

        console.log(`Added new release notes to ${file} under ${newVersionHeader}`)

        resolve()
      })
    })
  })
}

/**
 * Returns an RFC3339 date-string for the current day in the Pacific
 * (Los Angeles) time zone.
 *
 * @returns {string} The date string.
 */
function getReleaseDate() {
  const tz = process.env.TZ
  process.env.TZ = 'America/Los_Angeles'
  const today = new Date(Date.now()).toLocaleDateString()
  process.env.TZ = tz

  const parts = today.split('/')
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
}

function getFormattedPrBody(data) {
  return [
    '## Proposed Release Notes',
    data.notes,
    '## Links',
    data.links,
    '',
    '## Details',
    ''
  ].join('\n')
}

/*
 * Exports slightly differ for tests vs. Github Actions
 * this allows us to require the function without it executing for tests,
 * and executing via `node` cli in GHA
 */
if (require.main === module) {
  prepareReleaseNotes()
} else {
  module.exports = {
    generateConventionalReleaseNotes,
    getReleaseDate,
    isValid
  }
}
