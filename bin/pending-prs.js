/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Github = require('./github')
const { App } = require('@slack/bolt')
const requiredEnvVars = ['GITHUB_TOKEN', 'SLACK_CHANNEL', 'SLACK_TOKEN', 'SLACK_SECRET']
const channel = process.env.SLACK_CHANNEL
const token = process.env.SLACK_TOKEN
const signingSecret = process.env.SLACK_SECRET
let missingEnvVars = []
const { program } = require('commander')
program.requiredOption(
  '--repos <repos>',
  'Comma-delimited list of repos in newrelic org to check for unreleased PRs'
)

/**
 * Finds the last released tag and all the PRs that have been
 * merged since last release.  It will then format the PR list
 * and send a slack message to `node-agent-dev`
 * to serve as a reminder to release.
 *
 * To use this script you must set the following env vars:
 * GITHUB_TOKEN - api token to talk to Github API(in CI this just uses the default token)
 * SLACK_CHANNEL - slack channel to send message
 * SLACK_TOKEN - token from bot
 * SLACK_SECRET - signing secret from bot
 *
 * `node ./bin/pending-prs.js --repos <comma-delimited repo list>`
 */
function unreleasedPRs() {
  try {
    if (!areEnvVarsSet()) {
      console.log(`${missingEnvVars.join(', ')} are not set.`)
      stopOnError()
    }

    program.parse()
    const opts = program.opts()

    const app = new App({
      token,
      signingSecret
    })

    const repos = opts.repos.split(',')

    repos.forEach(async (repo) => {
      const { prs, latestRelease } = await findMergedPRs(repo)

      let msg = null

      if (!prs.length) {
        msg = `:the-more-you-know: *${repo}* does not have any new PRs since \`${latestRelease.name}\` on *${latestRelease.published_at}*.`
      } else {
        msg = createSlackMessage(prs, latestRelease, repo)
      }

      await app.client.chat.postMessage({
        channel,
        text: msg
      })
      console.log(`Posted msg to ${channel}`)
    })
  } catch (err) {
    stopOnError(err)
  }
}

function stopOnError(err) {
  if (err) {
    console.error(err)
  }

  console.log('Halting execution with exit code: 1')
  process.exit(1)
}

function areEnvVarsSet() {
  missingEnvVars = requiredEnvVars.filter((envVar) => !process.env.hasOwnProperty(envVar))
  return missingEnvVars.length === 0
}

function createSlackMessage(prs, latestRelease, repo) {
  return `
    *${repo}*

  There have been ${prs.length} PRs merged since \`${latestRelease.name}\` on *${
    latestRelease.published_at
  }*.

  :waiting: *PRs not yet released*:

 - ${prs.join('\n - ')}

    Do you want to <https://github.com/newrelic/${repo}/actions/workflows/prepare-release.yml | prepare a release>?
    `
}

async function findMergedPRs(repo) {
  const github = new Github('newrelic', repo)
  const latestRelease = await github.getLatestRelease()
  console.log(
    `The latest release for ${repo} is: ${latestRelease.name} published: ${latestRelease.published_at}`
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

  console.log(`Found ${filteredPullRequests.length} PRs not yet released.`)
  const prs = filteredPullRequests.map((pr) => pr.html_url)
  return {
    prs,
    latestRelease
  }
}

unreleasedPRs()
