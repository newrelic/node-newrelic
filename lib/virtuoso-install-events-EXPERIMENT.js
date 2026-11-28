/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// EXPERIMENTAL -- intentionally built to be proven wrong and reverted.
//
// This embeds a User API key directly in the agent's own running process, and
// calls NerdGraph's installationCreateInstallStatus/installationCreateRecipeEvent
// mutations from inside the agent itself, the same way the standalone
// node-agent-install-with-events.sh script does from outside the agent.
//
// This is the exact trade-off discussed and rejected earlier: a User API key
// (NEW_RELIC_API_KEY), high-privilege and normally only ever held briefly by a
// human running an install script, now sits permanently in process.env of a
// long-running production process for as long as it runs. It also fires on
// every process start, not just "real" installs -- there is no way for the
// agent to tell a fresh install apart from the 500th routine restart.
//
// Only activates if NEW_RELIC_API_KEY and NEW_RELIC_ACCOUNT_ID are both set;
// otherwise this is a no-op and nothing changes.
//
// @param {Agent} agent The agent instance to observe.
function createVirtuosoInstallEventsExperiment(agent) {
  const apiKey = process.env.NEW_RELIC_API_KEY
  const accountId = process.env.NEW_RELIC_ACCOUNT_ID
  if (!apiKey || !accountId) {
    return
  }

  const region = process.env.NEW_RELIC_REGION || 'US'
  const REGION_APIS = {
    US: 'https://api.newrelic.com/graphql',
    EU: 'https://api.eu.newrelic.com/graphql',
    STAGING: 'https://staging-api.newrelic.com/graphql'
  }
  const api = REGION_APIS[region] || REGION_APIS.US

  const installId = process.env.INSTALL_ID || require('node:crypto').randomUUID()
  let reported = false

  async function nerdgraph(query, variables) {
    const response = await fetch(api, {
      method: 'POST',
      headers: { 'API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    })
    const body = await response.json()
    if (body.errors) {
      console.error('[virtuoso-experiment] NerdGraph error:', JSON.stringify(body.errors))
    }
    return body
  }

  function commonFields(error) {
    return {
      installId,
      cliVersion: 'agent-embedded-experiment/0.1.0',
      hostName: require('node:os').hostname(),
      os: 'linux',
      platform: process.platform,
      platformFamily: process.platform,
      platformVersion: 'n/a',
      kernelArch: process.arch,
      kernelVersion: require('node:os').release(),
      logFilePath: 'n/a',
      targetedInstall: true,
      error: error ? { message: String(error) } : {}
    }
  }

  function reportInstallStatus(state, error) {
    return nerdgraph(
      `mutation($accountId: Int!, $installStatus: InstallationInstallStatusInput!) {
        installationCreateInstallStatus(accountId: $accountId, installStatus: $installStatus) { installId state } }`,
      {
        accountId: Number(accountId),
        installStatus: Object.assign(commonFields(error), {
          state,
          deployedBy: 'agent-embedded-experiment',
          enabledProxy: false,
          isUnsupported: false,
          installLibraryVersion: 'n/a',
          redirectUrl: ''
        })
      }
    )
  }

  function reportRecipeEvent(status, entityGuid, error) {
    return nerdgraph(
      `mutation($accountId: Int!, $status: InstallationRecipeStatus!) {
        installationCreateRecipeEvent(accountId: $accountId, status: $status) { installId status } }`,
      {
        accountId: Number(accountId),
        status: Object.assign(commonFields(error), {
          name: 'node-agent-installer',
          displayName: 'Node Agent',
          status,
          complete: status !== 'INSTALLING',
          entityGuid: entityGuid || '',
          validationDurationMilliseconds: 0,
          metadata: {
            appName: agent.config.applications()[0],
            agentVersion: agent.version,
            installMethod: 'npm',
            installConfigName: 'node-js',
            installFlow: 'agent-embedded-experiment'
          }
        })
      }
    )
  }

  agent.on('starting', function onStarting() {
    console.log('[virtuoso-experiment] installId:', installId)
    reportInstallStatus('STARTED').catch(() => {})
    reportRecipeEvent('INSTALLING').catch(() => {})
  })

  agent.on('started', function onStarted() {
    if (reported) {
      return
    }
    reported = true
    reportRecipeEvent('INSTALLED', agent.config.entity_guid)
      .then(() => reportInstallStatus('COMPLETED'))
      .catch(() => {})
  })
}

module.exports = createVirtuosoInstallEventsExperiment
