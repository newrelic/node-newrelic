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
 * Some blockers carry the `healthStatus` code the agent reports for them (the
 * `HealthReporter` status constants); callers that have a health reporter use
 * it, while callers such as the CLI ignore it. `healthStatus` is optional — a
 * blocker the agent does not report a health status for simply omits it.
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
  },
  OPENTELEMETRY_BRIDGE_MISSING: {
    // The agent does not report a health status for this case, so no
    // `healthStatus` is carried.
    key: 'opentelemetry',
    message:
      'OpenTelemetry is enabled but the required @opentelemetry/* bridge ' +
      'packages are not installed, so the agent will not start. Install them ' +
      'or set opentelemetry.enabled to false.'
  }
}

// Each check reports whether its single blocker applies to the configuration.
// Reads are defensive so a configuration missing a sub-object (e.g. a partial
// or mock config) yields a blocker rather than throwing. The keys and order
// mirror the agent's runtime enforcement. A check may also read injected
// environment facts from `deps` for conditions that are not properties of the
// configuration itself.
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
  },
  opentelemetry(config, deps) {
    // Package availability is an environment fact, not a config property, so it
    // is injected. When it is not provided (undefined), the check cannot fire,
    // leaving callers that can't determine availability unaffected.
    return config?.opentelemetry?.enabled === true && deps?.otelBridgeAvailable === false
      ? BLOCKER.OPENTELEMETRY_BRIDGE_MISSING
      : null
  }
}

/**
 * Determines which hard startup blockers apply to a configuration. This never
 * throws, logs, or mutates state; a configuration that is missing fields simply
 * yields the corresponding blocker.
 *
 * By default every blocker (`agent_enabled`, then `app_name`, then
 * `license_key` (exempt when serverless mode is enabled), then `opentelemetry`)
 * is evaluated. Pass `field` to evaluate only that single blocker, so a caller
 * that cares about one condition is not affected by the others.
 *
 * @param {object} config A constructed agent `Config` instance.
 * @param {string} [field] A single blocker key to evaluate (`agent_enabled`,
 * `app_name`, `license_key`, or `opentelemetry`). When omitted, all blockers
 * are evaluated.
 * @param {object} [deps] Injected environment facts for checks whose condition
 * is not a property of the configuration. `deps.otelBridgeAvailable` (boolean)
 * is whether the OpenTelemetry bridge packages can be resolved; when omitted,
 * the `opentelemetry` check cannot fire.
 *
 * @returns {Array<object>} The applicable blockers, each `{ key, message }` and
 * optionally `healthStatus`. An empty array means the requested check(s) found
 * no blocker.
 */
function findStartupBlockers(config, field, deps = {}) {
  const keys = field === undefined ? Object.keys(CHECKS) : [field]
  const blockers = []
  for (const key of keys) {
    const blocker = CHECKS[key]?.(config, deps)
    if (blocker != null) {
      blockers.push(blocker)
    }
  }
  return blockers
}

module.exports = findStartupBlockers
module.exports.BLOCKER = BLOCKER
