/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const AGENT_RUN_BEHAVIOR = {
  SHUTDOWN: Symbol('Shutdown'),
  PRESERVE: Symbol('Preserve'),
  RESTART: Symbol('Restart')
}

/**
 * Encapsulates all the possible actions to take in response to the collector.
 */
class CollectorResponse {
  constructor(retainData, retryAfter, agentRun, payload) {
    this.retainData = retainData
    this.retryAfter = retryAfter
    this.agentRun = agentRun
    this.payload = payload
  }

  static get AGENT_RUN_BEHAVIOR() {
    return AGENT_RUN_BEHAVIOR
  }

  static success(payload) {
    return new CollectorResponse(false, 0, AGENT_RUN_BEHAVIOR.PRESERVE, payload)
  }

  static discard(payload) {
    return this.success(payload)
  }

  static error(payload) {
    return new CollectorResponse(true, 0, AGENT_RUN_BEHAVIOR.PRESERVE, payload)
  }

  static fatal(payload) {
    return new CollectorResponse(false, 0, AGENT_RUN_BEHAVIOR.SHUTDOWN, payload)
  }

  static retry(delayMS, payload) {
    return new CollectorResponse(true, delayMS, AGENT_RUN_BEHAVIOR.PRESERVE, payload)
  }

  static reconnect(delayMS, payload) {
    return new CollectorResponse(false, delayMS, AGENT_RUN_BEHAVIOR.RESTART, payload)
  }

  shouldPreserveRun() {
    return this.agentRun === AGENT_RUN_BEHAVIOR.PRESERVE
  }

  shouldShutdownRun() {
    return this.agentRun === AGENT_RUN_BEHAVIOR.SHUTDOWN
  }

  shouldRestartRun() {
    return this.agentRun === AGENT_RUN_BEHAVIOR.RESTART
  }
}

module.exports = CollectorResponse
