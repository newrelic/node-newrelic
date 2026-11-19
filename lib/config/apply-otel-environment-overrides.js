/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { LEVELS } = require('#agentlib/util/logger.js')
const formatters = require('./formatters.js')
const redactValue = require('./redact-value.js')

const OTEL_PREFIX = 'OTEL_'

// The log levels `logging.level` (and the underlying logger) recognize.
const VALID_LOG_LEVELS = new Set(Object.keys(LEVELS))

/**
 * Maps a supported `OTEL_*` environment variable to the `NEW_RELIC_*`
 * variable it is equivalent to, so the mapping can reuse the normal env var
 * resolution/coercion pipeline. `transform` adjusts the raw OTel value into
 * New Relic's shape before coercion, for vars whose semantics differ from
 * their New Relic equivalent (OpenTelemetry's capitalized log level names,
 * OTel's inverted "disabled" sense). `isValid`, when present, is checked
 * after `transform`; a value that fails it is ignored (with a warning)
 * rather than applied, per the OpenTelemetry bridge spec's requirement that
 * an unrecognized `OTEL_LOG_LEVEL` fall back to other configuration sources.
 *
 * @see https://github.com/newrelic/node-newrelic/issues/4177
 * @type {Object<string, {newRelicEnvVar: string, transform?: function(string): string, isValid?: function(string): boolean}>}
 */
const OTEL_ENV_VAR_MAP = {
  OTEL_SERVICE_NAME: { newRelicEnvVar: 'NEW_RELIC_APP_NAME' },
  OTEL_LOG_LEVEL: {
    newRelicEnvVar: 'NEW_RELIC_LOG_LEVEL',
    // The OpenTelemetry spec requires enum-valued env vars, such as this one,
    // to be treated case-insensitively, hence the lowercasing.
    transform: (value) => value.toLowerCase(),
    isValid: (value) => VALID_LOG_LEVELS.has(value)
  },
  // the otel env var is the inverse of NR option
  OTEL_SDK_DISABLED: {
    newRelicEnvVar: 'NEW_RELIC_ENABLED',
    transform: (value) => (formatters.boolean(value) ? 'false' : 'true')
  }
}

/**
 * Returns whether an environment variable is present and non-empty.
 *
 * @param {object} env The environment source.
 * @param {string} name The environment variable name.
 * @returns {boolean} True if the variable is set to a non-empty value.
 */
function isEnvVarSet(env, name) {
  return env[name] != null && env[name] !== ''
}

/**
 * Updates `targetConfig` in place with values mapped from `OTEL_*`
 * environment variables, per the agent-wide requirement that certain
 * OpenTelemetry environment variables be treated as their New Relic
 * equivalent when `opentelemetry.enabled` is `true`. Each supported
 * `OTEL_*` variable is resolved to the config path its `NEW_RELIC_*`
 * equivalent would set (see {@link OTEL_ENV_VAR_MAP}) and coerced the same
 * way that variable would be. A variable is skipped when its equivalent
 * `NEW_RELIC_*` variable is also set, since the New Relic variable must take
 * precedence. A value that fails its mapping's `isValid` check (currently
 * only `OTEL_LOG_LEVEL`) is skipped with a warning, leaving whatever other
 * configuration source (or default) `targetConfig` already carries for that
 * setting in place. Any other `OTEL_*` variable present in the environment,
 * that is not one of the supported mappings, is reported in a single debug
 * log line so a user can tell why an `OTEL_*` setting they expected to take
 * effect did not.
 *
 * @param {object} targetConfig The configuration object to update in place.
 * @param {object} deps Injectable dependencies.
 * @param {object} deps.env The environment source.
 * @param {object} deps.schema The schema module.
 * @param {AgentLogger} deps.logger A logger for tracing applied overrides.
 * @param {Function} deps.setAtPath Sets a value at a config path, creating
 * intermediate objects as needed.
 * @param {Function} deps.coerceValue Coerces a raw environment string to the
 * type a schema node declares.
 */
function applyOtelEnvironmentOverrides(targetConfig, { env, schema, logger, setAtPath, coerceValue }) {
  if (targetConfig.opentelemetry?.enabled !== true) {
    return
  }

  for (const [otelVar, mapping] of Object.entries(OTEL_ENV_VAR_MAP)) {
    if (!isEnvVarSet(env, otelVar) || isEnvVarSet(env, mapping.newRelicEnvVar)) {
      continue
    }

    const resolution = schema.resolveEnvVar(mapping.newRelicEnvVar)
    if (!resolution) {
      continue
    }

    const rawValue = mapping.transform ? mapping.transform(env[otelVar]) : env[otelVar]

    if (mapping.isValid && !mapping.isValid(rawValue)) {
      logger.warn(
        '%s is set to an unrecognized value (%s); falling back to other configuration ' +
          'sources or the default.',
        otelVar,
        env[otelVar]
      )
      continue
    }

    logger.trace(
      { env: { [otelVar]: redactValue(rawValue, { envRedaction: true }) } },
      'setting value from OpenTelemetry environment variable'
    )

    setAtPath(targetConfig, resolution.pathSegments, coerceValue(rawValue, resolution.node, logger))
  }

  const unmapped = Object.keys(env).filter(
    (name) => name.startsWith(OTEL_PREFIX) && !(name in OTEL_ENV_VAR_MAP)
  )
  if (unmapped.length > 0) {
    logger.debug(
      'Ignoring OpenTelemetry environment variable(s) not mapped to a New Relic setting: %s',
      unmapped.join(', ')
    )
  }
}

module.exports = { applyOtelEnvironmentOverrides }
