/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const HEARTBEAT_INTERVAL_MS = 60000

const HEALTH_STATUS = {
  connected: 'Agent has connected',
  heartbeat: 'Agent is running',
  shutdown: 'Agent has shutdown'
}

/**
 * Reports the agent's own lifecycle (connected, heartbeat, shutdown) as
 * NodeAgentState custom events. These ride the same license-key-authenticated
 * harvest cycle already used for Transaction and Error data -- no additional
 * credential or endpoint is introduced.
 *
 * @param {Agent} agent The agent instance to observe.
 */
function createAgentStateEvents(agent) {
  if (agent.config.agent_state_events && agent.config.agent_state_events.enabled === false) {
    return
  }

  if (agent.serverlessMode === true) {
    createServerlessAgentStateEvents(agent)
    return
  }

  const state = {
    connectAttempts: 0,
    connectingStartedAt: null,
    totalTransactions: 0,
    transactionsSinceLastHeartbeat: 0,
    heartbeatTimer: null
  }

  agent.on('connecting', function onConnecting() {
    state.connectAttempts++
    state.connectingStartedAt = Date.now()
  })

  agent.on('transactionFinished', function onTransactionFinished() {
    state.totalTransactions++
    state.transactionsSinceLastHeartbeat++
  })

  agent.on('started', function onStarted() {
    const registrationDurationMs = state.connectingStartedAt
      ? Date.now() - state.connectingStartedAt
      : 0

    recordState(agent, 'connected', {
      connectAttempts: state.connectAttempts,
      registrationDurationMs
    })

    clearInterval(state.heartbeatTimer)
    state.heartbeatTimer = setInterval(function onHeartbeat() {
      recordState(agent, 'heartbeat', {
        transactionsSinceLastHeartbeat: state.transactionsSinceLastHeartbeat,
        totalTransactions: state.totalTransactions
      })
      state.transactionsSinceLastHeartbeat = 0
    }, HEARTBEAT_INTERVAL_MS)
    state.heartbeatTimer.unref()
  })

  // Hooked on 'stopping' rather than 'stopped': by the time 'stopped' fires,
  // the collector connection has already cleared its run ID (see
  // CollectorAPI#shutdown), so a send attempted then is rejected as "not
  // connected" and silently dropped. 'stopping' fires while the connection
  // is still live, so the explicit send() below actually reaches the
  // collector before harvester.stop() and collector.shutdown() tear it down.
  agent.on('stopping', function onStopping() {
    clearInterval(state.heartbeatTimer)
    recordState(agent, 'shutdown', {
      totalTransactions: state.totalTransactions
    })
    agent.customEventAggregator.send()
  })
}

/**
 * Serverless (e.g. AWS Lambda) agents never go through the normal
 * connecting/connected/started sequence -- Agent#_serverlessModeStart skips
 * it entirely, so 'started' and 'stopping' never fire. 'starting' is the
 * only lifecycle event serverless agents still emit (it's set at the very
 * top of Agent#start, before the serverless short-circuit), so it's used
 * here as the cold-start signal instead.
 *
 * There's no heartbeat: a Lambda execution environment is frozen between
 * invocations, so a 60-second interval timer has no meaningful "running"
 * period to measure. There's no shutdown event either: Lambda containers
 * are frozen or killed without a guaranteed clean-exit signal, the same
 * class of gap as a hard kill in the non-serverless case. No explicit
 * send() is needed here -- whatever is queued in customEventAggregator by
 * the time the handler's harvestSync() runs (once per invocation) rides
 * along with the rest of that invocation's data automatically.
 *
 * @param {Agent} agent The agent instance to observe.
 */
function createServerlessAgentStateEvents(agent) {
  agent.on('starting', function onStarting() {
    recordState(agent, 'connected', {
      connectAttempts: 1,
      registrationDurationMs: 0
    })
  })
}

function recordState(agent, stateName, attributes) {
  const intrinsics = {
    type: 'NodeAgentState',
    timestamp: Date.now()
  }

  const payload = Object.assign(
    {
      state: stateName,
      appName: agent.config.applications()[0],
      pid: process.pid,
      agentVersion: agent.version,
      uptimeSeconds: process.uptime(),
      healthStatus: HEALTH_STATUS[stateName]
    },
    attributes
  )

  // eslint-disable-next-line sonarjs/pseudo-random
  agent.customEventAggregator.add([intrinsics, payload], Math.random())
}

module.exports = createAgentStateEvents
