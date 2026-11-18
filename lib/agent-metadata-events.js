/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const https = require('node:https')
const zlib = require('node:zlib')
const os = require('node:os')

const PATH = '/v1/agent-data/events'

const REGION_HOSTS = {
  US: 'otlp.nr-data.net',
  EU: 'otlp.eu01.nr-data.net',
  STAGING: 'staging-otlp.nr-data.net'
}

/**
 * Reports whether instrumentation actually started successfully
 * (state: 'success', on the agent's own 'started' state) or failed to connect
 * (state: 'failure', on the agent's own 'errored' state), to the dedicated
 * agent-metadata ingest endpoint (NR-550822). Authenticated with the license
 * key only -- no User API key, no NerdGraph. This rides a separate HTTPS
 * endpoint from the rest of the agent's data (Vortex's /v1/agent-data/events
 * path, not /agent_listener/invoke_raw_method).
 *
 * recordType is 'InstallStatus' here, deliberately not 'AgentMetadata': per
 * the ingest pipeline's own consumer code, any 'AgentMetadata'-typed record
 * is additionally mirrored into New Relic's own shared internal account
 * (11816188), regardless of whose license key sent it. A different
 * recordType value keeps this strictly inside the customer's own account.
 *
 * 'failure' records also carry a `reason` field: the human-readable message
 * from whichever condition caused the agent to transition to 'errored'
 * (missing app_name, missing license key, collector connect error, or
 * collector disconnect error), passed through by Agent#setState's second
 * argument.
 *
 * 'failure' is not subject to the shutdown race documented elsewhere in this
 * file: a failed connect does not exit the host process (the agent disables
 * itself but the app keeps running), so there's no rush for this send to
 * finish before anything exits.
 *
 * A bad-but-present license key does NOT make the agent emit 'errored': per
 * lib/collector/api.js, a 401 is treated as retryable and the agent just
 * backs off and retries connecting forever (by design, in case the key is
 * provisioned late). 'errored' only fires for a true fatal disconnect from
 * the collector (e.g. a 410) or a missing license key at startup -- and a
 * missing key can never produce a 'failure' record here anyway, since there
 * is no key to authenticate the report itself. So a stuck retry loop (e.g.
 * a bad key, or an unreachable collector host) will never produce a
 * 'failure' record; only a true fatal disconnect does.
 *
 * @param {Agent} agent The agent instance to observe.
 */
function createAgentMetadataEvents(agent) {
  if (agent.serverlessMode === true) {
    return
  }

  const region = process.env.NEW_RELIC_REGION || 'US'
  const host = REGION_HOSTS[region] || REGION_HOSTS.US

  function send(extra) {
    const licenseKey = agent.config.license_key
    if (!licenseKey) {
      return
    }

    const body = JSON.stringify(
      Object.assign(
        {
          recordType: 'InstallStatus',
          agentId: agent.config.run_id || 'unknown',
          agentName: 'nodejs',
          agentVersion: agent.version,
          hostName: os.hostname(),
          entityName: agent.config.applications()[0],
          language: 'nodejs',
          pid: process.pid,
          uptimeSeconds: process.uptime()
        },
        extra
      )
    )

    console.error('[agent-metadata-events DEBUG] send() called, state=' + extra.state)

    zlib.gzip(body, function onGzip(err, compressed) {
      if (err) {
        console.error('[agent-metadata-events DEBUG] gzip error', err)
        return
      }

      console.error('[agent-metadata-events DEBUG] gzip done, issuing request to ' + host + PATH)

      const req = https.request(
        {
          hostname: host,
          path: PATH,
          method: 'POST',
          headers: {
            'Api-Key': licenseKey,
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip',
            'Content-Length': compressed.length
          }
        },
        function onResponse(res) {
          console.error('[agent-metadata-events DEBUG] response status=' + res.statusCode)
          res.on('data', function noop() {})
        }
      )
      req.on('error', function onError(reqErr) {
        console.error('[agent-metadata-events DEBUG] request error', reqErr)
      })
      req.write(compressed)
      req.end()
      console.error('[agent-metadata-events DEBUG] req.end() called, state=' + extra.state)
    })
  }

  agent.on('started', function onStarted() {
    send({ state: 'success' })
  })

  agent.on('errored', function onErrored(reason) {
    send({ state: 'failure', reason })
  })

  agent.on('stopping', function onStopping() {
    send({ state: 'shutdown' })
  })
}

module.exports = createAgentMetadataEvents
