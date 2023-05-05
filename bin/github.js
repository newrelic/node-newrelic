/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { Octokit } = require('@octokit/rest')

if (!process.env.GITHUB_TOKEN) {
  console.log('GITHUB_TOKEN recommended to be set in ENV')
}

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
})

class Github {
  constructor(repoOwner = 'newrelic', repository = 'node-newrelic') {
    this.repoOwner = repoOwner
    this.repository = repository
  }

  async getLatestRelease() {
    const result = await octokit.repos.getLatestRelease({
      owner: this.repoOwner,
      repo: this.repository
    })

    return result.data
  }

  async getReleaseByTag(tag) {
    const results = await octokit.repos.getReleaseByTag({
      owner: this.repoOwner,
      repo: this.repository,
      tag
    })

    return results.data
  }

  async createRelease(tag, name, body) {
    const result = await octokit.repos.createRelease({
      owner: this.repoOwner,
      repo: this.repository,
      tag_name: tag,
      name: name,
      body: body
    })

    return result.data
  }

  async getTagByName(name) {
    const perPage = 100

    let pageNum = 1

    let result = null
    do {
      result = await octokit.repos.listTags({
        owner: this.repoOwner,
        repo: this.repository,
        per_page: perPage,
        page: pageNum
      })

      const found = result.data.find((tag) => {
        return tag.name === name
      })

      if (found) {
        return found
      }

      pageNum++
    } while (result.data.length === perPage) // there *might* be more data

    return null
  }

  async getCommit(sha) {
    const result = await octokit.repos.getCommit({
      owner: this.repoOwner,
      repo: this.repository,
      ref: sha
    })

    return result.data
  }

  async getMergedPullRequestsSince(date) {
    const perPage = 50

    const comparisonDate = new Date(date)

    let pageNum = 1
    const mergedPullRequests = []
    let result = null
    let hadData = false

    do {
      result = await octokit.pulls.list({
        owner: this.repoOwner,
        repo: this.repository,
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        per_page: perPage,
        page: pageNum
      })

      const mergedPrs = result.data.filter((pr) => {
        return pr.merged_at && new Date(pr.merged_at) > comparisonDate
      })

      mergedPullRequests.push(...mergedPrs)
      // Since we are going by 'updated' on query but merged on filter,
      // there's a chance some boundaries are off. While in super extreme
      // cases we could still miss some it is unlikely given we are grabbing
      // large pages.
      hadData = mergedPrs.length > 0

      pageNum++
    } while (result.data.length === perPage && hadData) // might be more in next batch

    return mergedPullRequests
  }

  async getPullRequestByCommit(sha) {
    const response = await octokit.repos.listPullRequestsAssociatedWithCommit({
      owner: this.repoOwner,
      repo: this.repository,
      commit_sha: sha
    })

    if (response.data.length) {
      return response.data[0]
    }
  }

  async getLatestWorkflowRun(nameOrId, branch) {
    // Appears to return in latest order.
    const runs = await octokit.actions.listWorkflowRuns({
      owner: this.repoOwner,
      repo: this.repository,
      workflow_id: nameOrId,
      branch: branch,
      per_page: 5
    })

    return runs.data.workflow_runs[0]
  }

  async createPR(options) {
    const { head, base, title, body, draft } = options

    await octokit.pulls.create({
      owner: this.repoOwner,
      repo: this.repository,
      head: head,
      base: base,
      title: title,
      body: body,
      draft: draft
    })
  }

  async updateRelease({ id, body }, retryCount = 1) {
    const MAX_RETRIES = 3

    if (retryCount > MAX_RETRIES) {
      throw new Error('Unable to update release with backoff')
    }

    try {
      return await octokit.repos.updateRelease({
        owner: this.owner,
        repo: this.repository,
        release_id: id,
        body
      })
    } catch (err) {
      await new Promise((resolve) => {
        const retryWait = 2 ** retryCount * 1000
        console.log(
          `Update Attempt #${retryCount} failed, waiting ${retryWait} ms before trying again`
        )

        setTimeout(resolve, retryWait)
      })

      return await this.updateRelease({ id, body }, retryCount + 1)
    }
  }
}

module.exports = Github
