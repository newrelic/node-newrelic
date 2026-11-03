/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('#agentlib/logger.js').child({
  component: 'apply-env-vars'
})
const formatters = require('./formatters.js')
const schemaModule = require('./schema.js')
const redactValue = require('./redact-value.js')
const { setSamplersFromEnv } = require('./samplers.js')

const ENV_PREFIX = 'NEW_RELIC_'

/**
 * Named coercions referenced by a schema node's `x-newrelic-coerce`
 * keyword, for coercions that the node's `type` alone cannot express (e.g.
 * distinguishing a comma-delimited string list from a JSON object list, both of
 * which are `type: array`). Each takes the raw environment string, the schema
 * node, and a logger, and returns the coerced value.
 *
 * @type {Object<string, function(string, object, object): *>}
 */
const COERCIONS = {
  object: (rawValue, schemaNode, logger) => formatters.object(rawValue, logger),
  objectList: (rawValue, schemaNode, logger) => formatters.objectList(rawValue, logger),
  regex: (rawValue, schemaNode, logger) => formatters.regex(rawValue, logger),
  allowList: (rawValue, schemaNode) => formatters.allowList(schemaNode.enum, rawValue),
  // For settings that accept either a number or a sentinel string (e.g.
  // `transaction_tracer.transaction_threshold`, which is a number of seconds or
  // the string `'apdex_f'`). A numeric value is parsed to a number; a
  // non-numeric value is passed through unchanged so the sentinel string
  // survives.
  numericOrString: (rawValue) => {
    const parsed = formatters.float(rawValue)
    return Number.isNaN(parsed) ? rawValue : parsed
  }
}

/**
 * Coerces an environment variable's string value to the type the schema
 * declares. A node's `x-newrelic-coerce` keyword names an explicit coercion
 * (see {@link COERCIONS}) and takes precedence. Otherwise the coercion is
 * derived from the node's `type` (boolean/integer/number/array). Types the
 * conversion can't unambiguously handle (strings, unions, oneOf, etc.) pass the
 * raw string through.
 *
 * @param {string} rawValue The environment variable value.
 * @param {object} schemaNode The setting's schema node.
 * @param {AgentLogger} logger A logger for coercions that report parse errors.
 * @returns {*} The coerced value.
 */
function coerceValue(rawValue, schemaNode, logger) {
  const coercion = COERCIONS[schemaNode['x-newrelic-coerce']]
  if (coercion !== undefined) {
    return coercion(rawValue, schemaNode, logger)
  }

  // A single declared type coerces predictably; anything else (unions, oneOf,
  // untyped) is left as the raw string for downstream handling.
  const type = typeof schemaNode.type === 'string' ? schemaNode.type : null
  switch (type) {
    case 'boolean':
      return formatters.boolean(rawValue)
    case 'integer':
      return formatters.int(rawValue)
    case 'number':
      return formatters.float(rawValue)
    case 'array':
      return formatters.array(rawValue)
    default:
      return rawValue
  }
}

/**
 * Sets a value at a path within an object, creating intermediate objects as
 * needed.
 *
 * @param {object} target The object to mutate.
 * @param {Array<string>} pathSegments The path to the value.
 * @param {*} value The value to set.
 */
function setAtPath(target, pathSegments, value) {
  let cursor = target
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i]
    if (cursor[segment] == null || typeof cursor[segment] !== 'object') {
      cursor[segment] = {}
    }
    cursor = cursor[segment]
  }
  cursor[pathSegments.at(-1)] = value
}

/**
 * Updates `targetConfig` in place with values discovered in the environment.
 *
 * Iterates the `NEW_RELIC_*` variables actually present in the environment
 * (rather than probing every schema node) and asks the schema to resolve each
 * name to the config path it sets. When a variable resolves to a setting, its
 * value is coerced to that node's schema type and assigned onto `targetConfig`
 * at that path. Variables that resolve to nothing are logged and skipped.
 *
 * @param {object} targetConfig The configuration object to update in place.
 * @param {object} [deps] Injectable dependencies for testing.
 * @param {object} [deps.env] The environment source. Defaults to `process.env`.
 * @param {object} [deps.schema] The schema module. Defaults to `./schema`.
 * @param {AgentLogger} [deps.logger] An optional logger for unrecognized
 * variables.
 * @returns {object} The same `targetConfig`, mutated.
 */
function applyEnvironmentOverrides(
  targetConfig,
  { env = process.env, schema = schemaModule, logger = defaultLogger } = {}
) {
  for (const name of Object.keys(env)) {
    if (name.startsWith(ENV_PREFIX) === false) continue

    const rawValue = env[name]
    if (rawValue == null || rawValue === '') continue

    const resolution = schema.resolveEnvVar(name)
    if (!resolution) {
      logger.debug(
        'Ignoring unrecognized New Relic environment variable %s',
        name
      )
      continue
    }

    logger.trace(
      { env: { [name]: redactValue(rawValue, { envRedaction: true }) } },
      'setting value from environment variable'
    )

    setAtPath(
      targetConfig,
      resolution.pathSegments,
      coerceValue(rawValue, resolution.node, logger)
    )

    // A distributed-tracing sampler set to a string ('trace_id_ratio_based' or
    // 'adaptive') is expanded into its object form from a second environment
    // variable (e.g. ..._TRACE_ID_RATIO_BASED_RATIO). Delegate that to the
    // sampler helper, which reads the second variable and rewrites the value.
    if (resolution.node['x-newrelic-sampler'] === true) {
      const paths = resolution.pathSegments.slice(0, -1)
      const key = resolution.pathSegments.at(-1)
      setSamplersFromEnv({
        key,
        config: targetConfig,
        paths,
        setNestedKey: setAtPath,
        logger
      })
    }
  }

  return targetConfig
}

module.exports = { applyEnvironmentOverrides }
