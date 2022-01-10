/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Github = require('./github')

const SUCCESS_MSG = '*** [OK] ***'
const WORKFLOWS = ['ci-workflow.yml']
const AGENT_REPO = 'node-newrelic'

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

async function checkWorkflowRun(repoOwner, repo, branch) {
  const github = new Github(repoOwner, repo)

  // only agent has smoke tests
  // add to list
  if (repo === AGENT_REPO) {
    WORKFLOWS.push('smoke-test-workflow.yml')
  }

  try {
    const successfulWorfklowRuns = WORKFLOWS.filter(async (workflow) => {
      const latestRun = await github.getLatestWorkflowRun(workflow, branch)
      if (latestRun === undefined) {
        console.log('No ci workflow run found.')
        return false
      }
      console.log(`${workflow} run details: ${JSON.stringify(formatRun(latestRun))}`)
      return latestRun.status === 'completed' && latestRun.conclusion === 'success'
    })

    if (successfulWorfklowRuns.length === WORKFLOWS.length) {
      console.log(SUCCESS_MSG)
      console.log(`${WORKFLOWS.join(', ')} were successful!`)
      return true
    }

    return false
  } catch (err) {
    console.error(err)

    return false
  }
}

module.exports = checkWorkflowRun
