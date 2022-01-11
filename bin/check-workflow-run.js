/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Github = require('./github')

const SUCCESS_MSG = '*** [OK] ***'

async function filterAsync(array, checkWorkflowSuccess) {
  const filterMap = await Promise.all(array.map(checkWorkflowSuccess))
  return array.filter((_, index) => filterMap[index])
}

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

async function checkWorkflowRun(repoOwner, repo, branch, workflows) {
  const github = new Github(repoOwner, repo)

  try {
    const successfulWorfklowRuns = await filterAsync(
      workflows,
      async function filterWorkflow(workflow) {
        const latestRun = await github.getLatestWorkflowRun(workflow, branch)
        if (latestRun === undefined) {
          console.log('No ci workflow run found.')
          return false
        }
        console.log(`${workflow} run details: ${JSON.stringify(formatRun(latestRun))}`)
        return latestRun.status === 'completed' && latestRun.conclusion === 'success'
      }
    )

    if (successfulWorfklowRuns.length === workflows.length) {
      console.log(SUCCESS_MSG)
      console.log(`${workflows.join(', ')} were successful!`)
      return true
    }

    return false
  } catch (err) {
    console.error(err)

    return false
  }
}

module.exports = checkWorkflowRun
