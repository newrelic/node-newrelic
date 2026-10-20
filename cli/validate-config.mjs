/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-console */

import { pathToFileURL } from 'node:url'
import validateConfig from '#agentlib/config/validate-config.js'
import findStartupBlockers from '#agentlib/config/find-startup-blockers.js'
import Config from '#agentlib/config/index.js'
import { applyEnvironmentOverrides } from '#agentlib/config/apply-environment-overrides.js'

// Config construction logs through this; the CLI wants it silent. Every method
// delegates to one no-op, and `child` returns the same logger, so there is a
// single implementation to exercise.
const noop = () => {}
const silentLogger = {
  warn: noop,
  error: noop,
  info: noop,
  debug: noop,
  trace: noop,
  child() {
    return silentLogger
  }
}

const FORMAT_TYPE = {
  HUMAN: 'human',
  JSON: 'json'
}

const EXIT_CODE = {
  VALID: 0,
  INVALID: 1,
  UNPROCESSABLE: 2
}

let writeOutput
let reportUnprocessable

export default async function validateCliConfig({
  format = FORMAT_TYPE.HUMAN,
  filePath
} = {}) {
  writeOutput = format === FORMAT_TYPE.HUMAN
    ? writeHuman
    : writeJson
  reportUnprocessable = format === FORMAT_TYPE.HUMAN
    ? reportUnprocessableHuman
    : reportUnprocessableJson

  let config
  try {
    config = await loadConfig(filePath)
  } catch (error) {
    reportUnprocessable(
      `Could not load configuration file "${filePath}": ${error.message}`
    )
    process.exitCode = EXIT_CODE.UNPROCESSABLE
    return
  }

  // Merge `NEW_RELIC_*` environment overrides into the loaded configuration
  // before validating it, exactly as the agent does when it builds its config.
  // This keeps both halves below (schema validation and startup blockers)
  // consistent with how the running agent would see the configuration.
  applyEnvironmentOverrides(config, { logger: silentLogger })

  // Schema validation catches structural/type problems. Startup blockers catch
  // configurations that are structurally valid but would prevent the agent
  // from starting (missing app_name/license_key, agent disabled). Both are
  // reported together so a passing result means the agent can actually start.
  const schemaErrors = validateConfig(config, false).errors ?? []
  const blockerErrors = findBlockerErrors(config)
  const errors = [...schemaErrors, ...blockerErrors]

  process.exitCode = errors.length === 0 ? EXIT_CODE.VALID : EXIT_CODE.INVALID
  writeOutput(errors.length === 0 ? null : errors)
}

/**
 * Builds a `Config` from the loaded configuration and returns any startup
 * blockers as validation-error entries (shaped like schema errors) so they can
 * be reported alongside them. Returns an empty array when the configuration is
 * startable.
 *
 * @param {object} config The loaded configuration object.
 *
 * @returns {Array<object>} Blocker entries, each `{ instancePath, message }`.
 */
function findBlockerErrors(config) {
  const built = new Config(config, { logger: silentLogger })
  return findStartupBlockers(built).map((blocker) => {
    return { instancePath: `/${blocker.key}`, message: blocker.message }
  })
}

/**
 * Loads a configuration file by path using Node.js's own module resolution,
 * exactly as the agent loads a configuration. The file is imported, letting
 * Node decide whether it is CommonJS or ECMAScript based on its extension and
 * the nearest `package.json` `type`.
 *
 * The configuration is read from the file's exported `config` property, whether
 * that is `export const config` (ESM) or `module.exports.config` /
 * `exports.config` (CommonJS). For an ESM module the property is a named export
 * (`namespace.config`); for CommonJS it lives on the default export
 * (`namespace.default.config`).
 *
 * @param {string} filePath Path to the configuration file to load.
 *
 * @returns {Promise<object>} The exported `config` object.
 */
async function loadConfig(filePath) {
  const url = pathToFileURL(filePath).href
  const namespace = await import(url)
  return namespace.config ?? namespace.default.config
}

function writeHuman(errors) {
  if (errors == null) {
    console.log('No configuration errors detected.')
    return
  }

  console.log('Found the following configuration errors:')
  for (const error of errors) {
    console.log(`  + ${error.instancePath}: ${error.message}`)
  }
}

function writeJson(errors) {
  if (errors == null) {
    console.log(
      JSON.stringify({ status: 0, errors: [] }, null, 2)
    )
    return
  }

  const result = {
    status: 1,
    errors: []
  }
  for (const error of errors) {
    result.errors.push({ [error.instancePath]: error.message })
  }
  console.log(
    JSON.stringify(result, null, 2)
  )
}

/**
 * Reports an input-processing failure (e.g. a file that cannot be loaded) as
 * a single human-readable line on stderr.
 *
 * @param {string} message The failure description.
 */
function reportUnprocessableHuman(message) {
  console.error(message)
}

/**
 * Reports an input-processing failure as a JSON object on stdout, mirroring the
 * shape produced by `writeJson` but with the unprocessable status code.
 *
 * @param {string} message The failure description.
 */
function reportUnprocessableJson(message) {
  console.log(
    JSON.stringify({ status: EXIT_CODE.UNPROCESSABLE, errors: [{ message }] }, null, 2)
  )
}
