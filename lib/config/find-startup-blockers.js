/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const HealthReporter = require('#agentlib/health-reporter.js')

/**
 * Startup blockers are configuration conditions that cause the agent to refuse
 * to start. They are enforced in agent code rather than by the configuration
 * JSON Schema, so a configuration can pass schema validation yet still prevent
 * the agent from starting. This module centralizes the detection of those
 * conditions so the agent runtime and the `validate-config` CLI share a single
 * source of truth.
 *
 * Each blocker carries the `healthStatus` code the agent reports for it (the
 * `HealthReporter` status constants); callers that have a health reporter use
 * it, while callers such as the CLI ignore it.
 */

const BLOCKER = {
  AGENT_DISABLED: {
    key: 'agent_enabled',
    healthStatus: HealthReporter.STATUS_AGENT_DISABLED,
    message:
      'The agent is disabled by its configuration (agent_enabled is not true), ' +
      'so it will not start.'
  },
  MISSING_APP_NAME: {
    key: 'app_name',
    healthStatus: HealthReporter.STATUS_MISSING_APP_NAME,
    message:
      'An application name is required. Set app_name in your configuration file ' +
      'or the NEW_RELIC_APP_NAME environment variable, or the agent will not start.'
  },
  MISSING_LICENSE_KEY: {
    key: 'license_key',
    healthStatus: HealthReporter.STATUS_LICENSE_KEY_MISSING,
    message:
      'A license key is required. Set license_key in your configuration file or ' +
      'the NEW_RELIC_LICENSE_KEY environment variable, or the agent will not start.'
  }
}

/**
 * Determines which hard startup blockers apply to a configuration. This is a
 * pure function: it reads the (already normalized) configuration and returns a
 * list of blockers without throwing, logging, or mutating any state.
 *
 * The checks and their order mirror the agent's runtime enforcement:
 * `agent_enabled`, then `app_name`, then `license_key` (which is exempt when
 * serverless mode is enabled, matching the agent's serverless start path).
 *
 * @param {object} config A constructed agent `Config` instance.
 *
 * @returns {Array<object>} The applicable blockers, each `{ key, healthStatus,
 * message }`. An empty array means the configuration is startable.
 */
function findStartupBlockers(config) {
  const blockers = []

  if (config.agent_enabled !== true) {
    blockers.push(BLOCKER.AGENT_DISABLED)
  }

  if (config.applications().length < 1) {
    blockers.push(BLOCKER.MISSING_APP_NAME)
  }

  if (config.serverless_mode.enabled !== true && !config.license_key) {
    blockers.push(BLOCKER.MISSING_LICENSE_KEY)
  }

  return blockers
}

module.exports = findStartupBlockers
module.exports.BLOCKER = BLOCKER
