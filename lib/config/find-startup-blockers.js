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

// Each check reports whether its single blocker applies to the configuration.
// Reads are defensive so a configuration missing a sub-object (e.g. a partial
// or mock config) yields a blocker rather than throwing. The keys and order
// mirror the agent's runtime enforcement.
const CHECKS = {
  agent_enabled(config) {
    return config?.agent_enabled !== true ? BLOCKER.AGENT_DISABLED : null
  },
  app_name(config) {
    const applications = config?.applications?.() ?? []
    return applications.length < 1 ? BLOCKER.MISSING_APP_NAME : null
  },
  license_key(config) {
    const serverless = config?.serverless_mode?.enabled === true
    return serverless === false && !config?.license_key
      ? BLOCKER.MISSING_LICENSE_KEY
      : null
  }
}

/**
 * Determines which hard startup blockers apply to a configuration. This never
 * throws, logs, or mutates state; a configuration that is missing fields simply
 * yields the corresponding blocker.
 *
 * By default every blocker (`agent_enabled`, then `app_name`, then
 * `license_key`, which is exempt when serverless mode is enabled) is evaluated.
 * Pass `field` to evaluate only that single blocker, so a caller that cares
 * about one condition is not affected by the others.
 *
 * @param {object} config A constructed agent `Config` instance.
 * @param {string} [field] A single blocker key to evaluate (`agent_enabled`,
 * `app_name`, or `license_key`). When omitted, all blockers are evaluated.
 *
 * @returns {Array<object>} The applicable blockers, each `{ key, healthStatus,
 * message }`. An empty array means the requested check(s) found no blocker.
 */
function findStartupBlockers(config, field) {
  const keys = field === undefined ? Object.keys(CHECKS) : [field]
  const blockers = []
  for (const key of keys) {
    const blocker = CHECKS[key]?.(config)
    if (blocker != null) {
      blockers.push(blocker)
    }
  }
  return blockers
}

module.exports = findStartupBlockers
module.exports.BLOCKER = BLOCKER
