'use strict'

const Github = require('./github')

const SUCCESS_MSG = '*** [OK] ***'

const formatRun = (run) => {
  return {
    name: run.name,
    repository: run.repository.name,
    repoOwner: run.repository.owner.login,
    branch: run.head_branch,
    status: run.status,
    url: run.url,
    workflow_id: run.workflow_id,
    event: run.event
  }
}

async function checkWorkflowRun(repoOwner, branch) {
  const github = new Github(repoOwner)

  try {
    const results = {
      ci: false,
      smokeTest: false
    }

    const latestRun = await github.getLatestWorkflowRun('ci-workflow.yml', branch)

    if (latestRun === undefined) {
      console.log('No ci workflow run found.')
    } else {
      console.log('CI workflow run details: ', JSON.stringify(formatRun(latestRun)))
      if (latestRun.status === 'completed' && latestRun.conclusion === 'success') {
        results.ci = true
      }
    }

    const latestSmokeTestRun = await github.getLatestWorkflowRun('smoke-test-workflow.yml', branch)

    if (latestSmokeTestRun === undefined) {
      console.log('No smoke test workflow run found.')
    } else {
      console.log('Smoke-test workflow run details: ', JSON.stringify(formatRun(latestSmokeTestRun)))

      if (latestSmokeTestRun.status === 'completed' && latestSmokeTestRun.conclusion === 'success') {
        results.smokeTest = true
      }
    }

    if (results.ci && results.smokeTest) {
      console.log(SUCCESS_MSG)
      console.log('Latest ci and smoke-test runs were successful!')
      return true
    }

    if (!results.ci) {
      console.log('Latest ci workflow run result was not \'completed\' and \'success\'.')
    }

    if (!results.smokeTest) {
      console.log('Latest smoke-test workflow run result was not \'completed\' and \'success\'.')
    }

    return false
  } catch (err) {
    console.error(err)

    return false
  }
}

module.exports = checkWorkflowRun
