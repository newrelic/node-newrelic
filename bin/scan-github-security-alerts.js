#!/usr/bin/env node
/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { Octokit } = require('@octokit/rest')
const { App } = require('@slack/bolt')
const { Command } = require('commander')

const ORG = 'newrelic'
const requiredEnvVars = ['GITHUB_TOKEN', 'SLACK_CHANNEL', 'SLACK_TOKEN', 'SLACK_SECRET']
const channel = process.env.SLACK_CHANNEL
const token = process.env.SLACK_TOKEN
const signingSecret = process.env.SLACK_SECRET
let missingEnvVars = []

const program = new Command()
program.requiredOption(
  '--repos <repos>',
  'Comma-delimited list of repos in the newrelic org to scan for open security alerts'
)
program.option('--dry-run', 'Execute the logic but do not send slack message')

/**
 * Fetches all open secret scanning and code scanning alerts for each repo
 * and posts them to Slack.
 *
 * To use this script you must set the following env vars:
 * GITHUB_TOKEN - api token to talk to Github API
 * SLACK_CHANNEL - slack channel to post alerts to
 * SLACK_TOKEN - token from bot
 * SLACK_SECRET - signing secret from bot
 *
 * `node ./bin/scan-github-security-alerts.js --repos <comma-delimited repo list>`
 */
async function scanSecurityAlerts() {
  try {
    program.parse()
    const opts = program.opts()

    if (!areEnvVarsSet(opts.dryRun)) {
      console.log(`${missingEnvVars.join(', ')} are not set.`)
      stopOnError()
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    const app = opts.dryRun ? null : new App({ token, signingSecret })
    const repos = opts.repos?.split(',') ?? []

    for (const repo of repos) {
      console.log(`\nScanning ${ORG}/${repo}...`)

      await Promise.all([
        scanSecretAlerts({ app, octokit, repo, isDryRun: opts.dryRun }),
        scanCodeAlerts({ app, octokit, repo, isDryRun: opts.dryRun })
      ])
    }
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

async function scanSecretAlerts({ app, octokit, repo, isDryRun }) {
  const secretAlerts = await fetchSecretScanningAlerts(octokit, repo)
  console.log(`${secretAlerts.length} secret scanning alert(s)`)

  for (const alert of secretAlerts) {
    const blocks = buildSecretAlertBlocks(repo, alert)
    if (isDryRun) {
      console.log(`[DRY RUN] Secret alert #${alert.number}:`, JSON.stringify(blocks, null, 2))
    } else {
      await app.client.chat.postMessage({ channel, blocks })
      console.log(`Posted secret alert #${alert.number} to ${channel}`)
    }
  }
}

async function scanCodeAlerts({ app, octokit, repo, isDryRun }) {
  const codeAlerts = await fetchCodeScanningAlerts(octokit, repo)
  console.log(`${codeAlerts.length} code scanning alert(s)`)
  for (const alert of codeAlerts) {
    const blocks = buildCodeAlertBlocks(repo, alert)
    if (isDryRun) {
      console.log(`[DRY RUN] Code alert #${alert.number}:`, JSON.stringify(blocks, null, 2))
    } else {
      await app.client.chat.postMessage({ channel, blocks })
      console.log(`Posted code alert #${alert.number} to ${channel}`)
    }
  }
}

function areEnvVarsSet(dryRun) {
  if (dryRun) {
    return Object.prototype.hasOwnProperty.call(process.env, 'GITHUB_TOKEN')
  }
  missingEnvVars = requiredEnvVars.filter(
    (envVar) => !Object.prototype.hasOwnProperty.call(process.env, envVar)
  )
  return missingEnvVars.length === 0
}

async function fetchSecretScanningAlerts(octokit, repo) {
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/secret-scanning/alerts', {
      owner: ORG,
      repo,
      state: 'open',
      per_page: 100
    })
    return data
  } catch (err) {
    if (err.status === 404) {
      console.log(`  Secret scanning not enabled for ${repo}, skipping.`)
      return []
    }
    throw err
  }
}

async function fetchCodeScanningAlerts(octokit, repo) {
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/code-scanning/alerts', {
      owner: ORG,
      repo,
      state: 'open',
      per_page: 100
    })
    return data
  } catch (err) {
    if (err.status === 404) {
      console.log(`  Code scanning not enabled for ${repo}, skipping.`)
      return []
    }
    throw err
  }
}

function buildSecretAlertBlocks(repo, alert) {
  const repoUrl = `https://github.com/${ORG}/${repo}`
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Secret Scanning Alert' }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Repository:*\n<${repoUrl}|${ORG}/${repo}>` },
        { type: 'mrkdwn', text: `*Details:*\n*Type:* ${alert.secret_type_display_name ?? alert.secret_type}` }
      ]
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: `Alert #${alert.number}` },
          url: alert.html_url,
          style: 'primary'
        }
      ]
    }
  ]
}

function buildCodeAlertBlocks(repo, alert) {
  const repoUrl = `https://github.com/${ORG}/${repo}`
  const severity = (alert.rule.severity ?? 'unknown').toUpperCase()
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Code Scanning Alert' }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Repository:*\n<${repoUrl}|${ORG}/${repo}>` },
        {
          type: 'mrkdwn',
          text: `*Details:*\n*Rule:* ${alert.rule.description ?? alert.rule.id}\n*Severity:* ${severity}\n*Tool:* ${alert.tool.name}`
        }
      ]
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: `Alert #${alert.number}` },
          url: alert.html_url,
          style: 'primary'
        }
      ]
    }
  ]
}

if (require.main === module) {
  scanSecurityAlerts()
} else {
  module.exports = {
    areEnvVarsSet,
    buildSecretAlertBlocks,
    buildCodeAlertBlocks,
    fetchSecretScanningAlerts,
    fetchCodeScanningAlerts,
    scanCodeAlerts,
    scanSecretAlerts
  }
}
