/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Github = require('./github')
const SECURITY_PREFIX = 'security:'

module.exports = async function updateSnykPR() {
  const org = process.env.RELEASE_ORG || 'newrelic'
  const repo = process.env.RELEASE_REPO || 'node-newrelic'
  const prId = process.env.SNYK_PR_ID

  if (!prId) {
    throw new Error('SNYK_PR_ID is a required environment variable')
  }

  const github = new Github(org, repo)

  const { title: originalTitle } = await github.getPullRequest(prId)

  if (originalTitle.startsWith(SECURITY_PREFIX)) {
    console.log(`PR #${prId} already has correct prefix, skipping update`)
    return
  }
  const newTitle = [SECURITY_PREFIX, originalTitle].join(' ')

  await github.updatePullRequest({ id: prId, title: newTitle })
}
