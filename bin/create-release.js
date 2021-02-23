'use strict'

const {exec} = require('child_process')
const checkWorkflowRun = require('./check-workflow-run')
const {program, Option} = require('commander')

const ERROR_MSG = '! [ERROR] !\n'

// Add command line options
program.option('-b, --branch <branch>', 'release branch', 'main')

program.addOption(new Option('-r, --release-type <releaseType>', 'release type')
  .choices(['patch', 'minor', 'major']))

program.option('-m, --major-release', 'create a major release. (release-type option must be set to \'major\')')

program.option('-o, --repo-owner <repoOwner>', 'repository owner', 'newrelic')

async function createRelease() {
  // Parse commandline options inputs
  program.parse()

  const options = program.opts()

  // TODO: rework to use program.requiredOption
  if (!options.releaseType) {
    console.log('FAILURE: release type required.')
    process.exit(1)
  }

  if (options.releaseType === 'major' && !options.majorRelease) {
    console.log('WARNING: you must set the \'-m\' flag to create a major release.\nExiting...')
    process.exit(1)
  }

  if (options.majorRelease && options.releaseType !== 'major') {
    console.log(`WARNING: ignoring \'-m, --major-release\' option as release type set to ${options.rel}.`)
  }

  const releaseType = options.releaseType
  const branch = options.branch ? options.branch.replace('refs/heads/', '') : null
  const repoOwner = options.repoOwner ? options.repoOwner : null

  try {
    const passesWorkflowChecks = await checkWorkflowRun(repoOwner, branch)

    if (!passesWorkflowChecks) {
      process.exit(1)
    }
  } catch (err) {
    console.log(err)

    process.exit(1)
  }

  console.log('Starting npm version and pushing tags')
  exec(`npm version ${releaseType} && git push origin ${branch} && git push --tags`, (err, stdout) => {
    if (err) {
      console.log(ERROR_MSG, err)

      process.exit(1)
    }

    if (stdout) {
      console.log(stdout)
    }

    console.log('DONE')

    process.exit(0)
  })
}

createRelease()
