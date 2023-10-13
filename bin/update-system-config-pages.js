/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { program } = require('commander')
const API_ENDPOINT = '/v2/system_configuration.json'
const STAGING_HOST = 'https://staging-api.newrelic.com'
const PRD_US_HOST = 'https://api.newrelic.com'

program.requiredOption('--version <version>', 'New version of node agent')
program.requiredOption('--staging-key <key>', 'New Relic API key for staging')
program.requiredOption('--prod-key <key>', 'New Relic API Key for prod')

/**
 * Generates the post body with the proper agent version
 *
 * @param {string} version new agent version
 * @returns {object} body payload
 */
function getPayload(version) {
  return {
    system_configuration: {
      key: 'nodejs_agent_version',
      value: version
    }
  }
}

/**
 * Formats the request object based on host, version, and api key
 *
 * @param {string} host API host endpoint
 * @param {string} version new agent version
 * @param {string} key API key for relevant host
 * @returns {object} formatted request object
 */
function formatRequest(host, version, key) {
  const opts = {
    method: 'POST',
    headers: {
      'X-Api-Key': key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(getPayload(version))
  }

  return [`${host}${API_ENDPOINT}`, opts]
}

/**
 * Makes 3 concurrent requests to staging, production US and EU to update
 * the system configuration pages for the nodejs_agent_version
 */
async function updateSystemConfigs() {
  const errors = []
  program.parse()
  const opts = program.opts()
  const stagingRequest = fetch(...formatRequest(STAGING_HOST, opts.version, opts.stagingKey))
  const prodUsRequest = fetch(...formatRequest(PRD_US_HOST, opts.version, opts.prodKey))
  try {
    const responses = await Promise.all([stagingRequest, prodUsRequest])
    responses.forEach(async (response) => {
      const res = await response.json()
      if (![200, 201].includes(response.status)) {
        errors.push(JSON.stringify(res.body))
      }
    })

    if (errors.length) {
      throw new Error(errors)
    }

    console.log(`Successfully updated the Node.js Agent Version to ${opts.version}`)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

updateSystemConfigs()
