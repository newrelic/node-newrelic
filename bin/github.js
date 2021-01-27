'use strict'

const { Octokit } = require("@octokit/rest")

const repoOwner = 'newrelic'
const repository = 'node-newrelic'

if (!process.env.GITHUB_TOKEN) {
  console.log('GITHUB_TOKEN recommended to be set in ENV')
}

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
})

async function getLatestRelease() {
  const result = await octokit.repos.getLatestRelease({
    owner: repoOwner,
    repo: repository
  })

  return result.data
}

async function getTagByName(name) {
  const perPage = 100

  let pageNum = 1

  let result = null
  do {
    result = await octokit.repos.listTags({
      owner: repoOwner,
      repo: repository,
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

async function getCommit(sha) {
  const result = await octokit.repos.getCommit({
    owner: repoOwner,
    repo: repository,
    ref: sha
  })

  return result.data
}

async function getMergedPullRequestsSince(date) {
  const perPage = 50

  const comparisonDate = new Date(date)

  let pageNum = 1
  const mergedPullRequests = []
  let result = null
  let hadData = false

  do {
    result = await octokit.pulls.list({
      owner: repoOwner,
      repo: repository,
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

module.exports = {
  getLatestRelease,
  getTagByName,
  getCommit,
  getMergedPullRequestsSince
}
