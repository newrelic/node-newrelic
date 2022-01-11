/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { program } = require('commander')

const checkWorkflowRun = require('./check-workflow-run')
const git = require('./git-commands')

// Add command line options
program.option('-b, --branch <branch>', 'release branch', 'main')
program.option(
  '--repo <repo>',
  'Repo to work against(Defaults to newrelic/node-newrelic)',
  'newrelic/node-newrelic'
)
program.option('-f --force', 'bypass validation')
program.option(
  '-w, --workflows <workflows>',
  'Comma delimited list of workflows to check',
  'ci-workflow.yml'
)

async function createReleaseTag() {
  // Parse commandline options inputs
  program.parse()

  const options = program.opts()

  console.log('Script running with following options: ', JSON.stringify(options))

  const branch = options.branch.replace('refs/heads/', '')
  const [owner, repo] = options.repo.split('/')
  const workflows = options.workflows.split(',')

  if (options.force) {
    console.log('--force set. Skipping validation logic')
  }

  try {
    const isValid =
      options.force ||
      ((await validateLocalChanges()) &&
        (await validateCurrentBranch(branch)) &&
        (await checkWorkflowRun(owner, repo, branch, workflows)))

    if (!isValid) {
      process.exit(1)
    }

    const packagePath = `${process.cwd()}/package.json`
    console.log(`Extracting new version from ${packagePath}`)
    const packageInfo = require(packagePath)

    const version = `v${packageInfo.version}`
    console.log('New version is: ', version)

    console.log('Creating and pushing tag')

    await git.createAnnotatedTag(version, version)
    await git.pushTags()

    console.log('*** Full Run Successful ***')
  } catch (err) {
    console.log(err)

    process.exit(1)
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

createReleaseTag()
