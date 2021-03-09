'use strict'

const {program} = require('commander')

const checkWorkflowRun = require('./check-workflow-run')
const git = require('./git-commands')

// Add command line options
program.option('-b, --branch <branch>', 'release branch', 'main')
program.option('-o, --repo-owner <repoOwner>', 'repository owner', 'newrelic')
program.option('-f --force', 'bypass validation')

async function createReleaseTag() {
  // Parse commandline options inputs
  program.parse()

  const options = program.opts()

  console.log('Script running with following options: ', JSON.stringify(options))

  const branch = options.branch.replace('refs/heads/', '')
  const repoOwner = options.repoOwner

  if (options.force) {
    console.log('--force set. Skipping validation logic')
  }

  try {
    const isValid = options.force || (
      await validateLocalChanges() &&
      await validateCurrentBranch(branch) &&
      await checkWorkflowRun(repoOwner, branch)
    )

    if (!isValid) {
      process.exit(1)
    }

    const packagePath = '../package.json'
    console.log('Extracting new version from package.json here: ', )
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

createReleaseTag()
