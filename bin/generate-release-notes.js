'use strict'

const fs = require('fs')

const {program} = require('commander')

const Github = require('./github')
const git = require('./git-commands')
const logger = require('../lib/logger')

const FILE_NAME = 'NEWS.md'
const PROPOSED_NOTES_HEADER = 'Proposed Release Notes'
const NEXT_VERSION_HEADER = '### vNext (TBD):'

const FORCE_RUN_DEAFULT_REMOTE = 'origin'
const DEFAULT_NEW_BRANCH_NAME = 'update-release-notes'

// Add command line options
program.option('--remote <remote>', 'remote to push branch to', 'origin')
program.option('--branch <branch>', 'branch to generate notes from', 'main')
program.option('--repo-owner <repoOwner>', 'repository owner', 'newrelic')
program.option('--dry-run', 'generate notes without creating a branch or PR')
program.option('--no-pr', 'generate notes and branch but do not create PR')
program.option('-f --force', 'bypass validation')

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

async function prepareReleaseNotes() {
  // Parse commandline options inputs
  program.parse()

  const options = program.opts()

  console.log('Script running with following options: ', JSON.stringify(options))

  logStep('Validation')

  if (options.force) {
    console.log('--force set. Skipping validation logic')
  }

  const isValid = options.force || (
    await validateRemote(options.remote) &&
    await validateLocalChanges() &&
    await validateCurrentBranch(options.branch)
  )

  if (!isValid) {
    console.log('Invalid configuration. Halting script.')
    stopOnError()
  }

  const remote = options.remote || FORCE_RUN_DEAFULT_REMOTE
  console.log('Using remote: ', remote)

  try {
    logStep('Branch Creation')

    const newBranchName = `${Date.now()}-${DEFAULT_NEW_BRANCH_NAME}`

    if (options.dryRun) {
      console.log('Dry run indicated (--dry-run), not creating branch.')
    } else {
      console.log('Creating and checking out new branch: ', newBranchName)
      await git.checkoutNewBranch(newBranchName)
    }

    logStep('Create Release Notes')

    const releaseData = await generateReleaseNotes()
    await updateReleaseNotesFile(FILE_NAME, releaseData.notes)

    if (options.dryRun) {
      console.log('\nDry run indicated (--dry-run), skipping remaining steps.')
      return
    }

    logStep('Commit and Push Branch')

    console.log('Adding, committing and pushing branch to remote: ', remote)
    await git.addAllFiles()
    await git.commit('Adds auto-generated release notes.')
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

    console.log('Creating draft PR with new release notes for repo owner: ', options.repoOwner)
    const remoteApi = new Github(options.repoOwner)
    const title = 'Updates release notes for next release'
    const body = getFormattedPrBody(releaseData)
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

    if (branch != currentBranch) {
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

async function generateReleaseNotes() {
  const github = new Github()
  const latestRelease = await github.getLatestRelease()
  console.log(`The latest release is: ${latestRelease.name} published: ${latestRelease.published_at}`)
  console.log(`Tag: ${latestRelease.tag_name}, Target: ${latestRelease.target_commitish}`)

  const tag = await github.getTagByName(latestRelease.tag_name)
  console.log('The tag commit sha is: ', tag.commit.sha)

  const commit = await github.getCommit(tag.commit.sha)
  const commitDate = commit.commit.committer.date

  console.log(`Finding merged pull requests since: ${commitDate}`)

  const mergedPullRequests = await github.getMergedPullRequestsSince(commitDate)
  console.log(`Found ${mergedPullRequests.length}`)

  const releaseNoteData = mergedPullRequests.map((pr) => {
    const parts = pr.body.split(/(?:^|\n)##\s*/g)

    // If only has one part, not in appropriate format.
    if (parts.length === 1) {
      return {
        notes: generateUnformattedNotes(pr.body),
        url: pr.html_url
      }
    }

    const {1: proposedReleaseNotes} = parts

    const titleRemoved = proposedReleaseNotes.replace(PROPOSED_NOTES_HEADER, '')
    return {
      notes: titleRemoved,
      url: pr.html_url
    }
  })

  const finalData = releaseNoteData.reduce((result, currentValue) => {
    result.notes += '\n\n' + currentValue.notes.trim()
    result.links += `\n* PR: ${currentValue.url}`
    return result
  }, {
    notes: '',
    links: ''
  })

  return finalData
}

function generateUnformattedNotes(originalNotes) {
  let unformattedNotes = originalNotes

  // Drop extra snyk details and just keep high-level summary.
  if (originalNotes.indexOf('snyk:metadata') >= 0) {
    const snykParts = originalNotes.split('<hr/>')
    const {0: snykDescription} = snykParts

    unformattedNotes = snykDescription.trim()
  }

  const needsReviewNotes = [
    '--- NOTES NEEDS REVIEW ---',
    unformattedNotes,
    '--------------------------'
  ].join('\n')

  return needsReviewNotes
}

function updateReleaseNotesFile(file, newNotes) {
  const promise = new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', function (err, data) {
      if (err) {
        return reject(err)
      }

      if (data.startsWith(NEXT_VERSION_HEADER)) {
        const errMessage = [
          `${file} already contains '${NEXT_VERSION_HEADER}'`,
          'Delete existing vNext release notes (if desired) and run again'
        ].join('\n')

        return reject(new Error(errMessage))
      }

      const newContent = [
        NEXT_VERSION_HEADER,
        newNotes,
        '\n\n',
        data
      ].join('')

      fs.writeFile(file, newContent, 'utf8', function (err) {
        if (err) {
          return reject(err)
        }

        console.log(`Added new release notes to ${file} under the ${NEXT_VERSION_HEADER}`)

        resolve()
      })
    })
  })

  return promise
}

function getFormattedPrBody(data) {
  const body = [
    '## Proposed Release Notes',
    data.notes,
    '## Links',
    data.links,
    '',
    '## Details',
    ''
  ].join('\n')

  return body
}

prepareReleaseNotes()
