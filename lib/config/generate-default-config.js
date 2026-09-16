/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('node:path')
const schemaModule = require('./schema')

let cached

/**
 * Renders a schema node into its default value: a leaf's own `default`, or, for
 * an object node, an object of its properties' rendered defaults. Returns
 * `undefined` for nodes with no default (including `oneOf`/`anyOf` nodes, whose
 * default, if any, lives on the node itself).
 *
 * @param {object} node The schema node, possibly a `$ref`.
 * @param {Function} resolveRef Resolves a `$ref` string to its schema object.
 * @returns {*} The rendered default, or undefined.
 */
function renderDefaults(node, resolveRef) {
  const resolved = node && node.$ref ? resolveRef(node.$ref) : node
  if (!resolved || typeof resolved !== 'object') {
    return undefined
  }
  if (Object.prototype.hasOwnProperty.call(resolved, 'default')) {
    return resolved.default
  }
  if (resolved.type === 'object' && resolved.properties) {
    const out = {}
    for (const [key, child] of Object.entries(resolved.properties)) {
      const value = renderDefaults(child, resolveRef)
      if (value !== undefined) {
        out[key] = value
      }
    }
    return out
  }
  return undefined
}

/**
 * Builds the agent's default configuration object from the JSON Schema, then
 * fills in the values the schema cannot express as static literals because they
 * are computed at load time:
 *
 * - `license_key`: a placeholder empty string (the schema requires a real key).
 * - `logging.filepath`: defaults to `<cwd>/newrelic_agent.log`.
 * - `serverless_mode.enabled`: true when the process looks like an AWS Lambda
 *   (the `AWS_LAMBDA_FUNCTION_NAME` environment variable is present).
 *
 * The result is equivalent to the object produced by `buildConfig` in
 * `lib/config/default.js`.
 *
 * @param {object} [params] Function parameters.
 * @param {object} [params.env] The environment source. Defaults to `process.env`.
 * @param {string} [params.cwd] The working directory. Defaults to `process.cwd()`.
 * @param {boolean} [params.skipCache] When `true`, do not return the cached
 * config object. Instead, build a new one and replace the cache with it.
 *
 * @returns {object} The default configuration object.
 */
function generateDefaultConfig({
  env = process.env,
  cwd = process.cwd(),
  skipCache = false
} = {}) {
  if (cached !== undefined && skipCache === false) return cached

  const { schema, resolveRef } = schemaModule

  const config = {}
  for (const [key, child] of Object.entries(schema.properties)) {
    const value = renderDefaults(child, resolveRef)
    if (value !== undefined) {
      config[key] = value
    }
  }

  // Apply the values the schema cannot carry as static defaults.
  config.license_key = ''
  config.logging = config.logging || {}
  config.logging.filepath = path.join(cwd, 'newrelic_agent.log')
  config.serverless_mode = config.serverless_mode || {}
  config.serverless_mode.enabled = env.AWS_LAMBDA_FUNCTION_NAME != null

  cached = config
  return cached
}

module.exports = { generateDefaultConfig, renderDefaults }
