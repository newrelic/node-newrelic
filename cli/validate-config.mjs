/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-console */

import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import validateConfig from '#agentlib/config/validate-config.js'
import findStartupBlockers from '#agentlib/config/find-startup-blockers.js'
import Config from '#agentlib/config/index.js'
import { applyEnvironmentOverrides } from '#agentlib/config/apply-environment-overrides.js'
import { generateDefaultConfig } from '#agentlib/config/generate-default-config.js'
import { isOtelBridgeAvailable } from '#agentlib/otel/bridge-available.js'

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

const DUMP_FORMAT = {
  CJS: 'cjs',
  ESM: 'esm',
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
  outputFormat = FORMAT_TYPE.HUMAN,
  filePath,
  dump,
  dumpFormat = DUMP_FORMAT.CJS
} = {}) {
  writeOutput = outputFormat === FORMAT_TYPE.HUMAN
    ? writeHuman
    : writeJson
  reportUnprocessable = outputFormat === FORMAT_TYPE.HUMAN
    ? reportUnprocessableHuman
    : reportUnprocessableJson

  // `dump` is undefined when `--dump` was not passed, '' for a bare `--dump`,
  // or a mode string such as 'full'. `--format` only matters alongside `--dump`.
  const dumpRequested = dump !== undefined
  if (dumpRequested === true && isValidDumpFormat(dumpFormat) === false) {
    reportUnprocessable(
      `Invalid --format "${dumpFormat}". Expected one of: ` +
        `${Object.values(DUMP_FORMAT).join(', ')}.`
    )
    process.exitCode = EXIT_CODE.UNPROCESSABLE
    return
  }

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

  // A single constructed Config supplies both the startup-blocker checks and
  // the normalized values used when dumping.
  const built = new Config(config, { logger: silentLogger })

  // The OpenTelemetry bridge requires packages resolvable from the
  // configuration file's location, which is where the agent runs, so check
  // availability anchored there rather than at the CLI's own location.
  const otelBridgeAvailable = isOtelBridgeAvailable(pathToFileURL(resolve(filePath)).href)

  // Schema validation catches structural/type problems. Startup blockers catch
  // configurations that are structurally valid but would prevent the agent
  // from starting (missing app_name/license_key, agent disabled, OpenTelemetry
  // bridge packages missing). Both are reported together so a passing result
  // means the agent can actually start.
  const schemaErrors = validateConfig(config, false).errors ?? []
  const blockerErrors = findStartupBlockers(built, undefined, { otelBridgeAvailable }).map((blocker) => {
    return { instancePath: `/${blocker.key}`, message: blocker.message }
  })
  const errors = [...schemaErrors, ...blockerErrors]

  if (dumpRequested === true) {
    // Only dump a valid, startable configuration so a redirected stdout yields
    // a complete, re-loadable file. Otherwise report the errors to stderr and
    // leave stdout empty.
    if (errors.length > 0) {
      for (const error of errors) {
        console.error(`${error.instancePath}: ${error.message}`)
      }
      process.exitCode = EXIT_CODE.INVALID
      return
    }

    const template = dump === 'full'
      ? generateDefaultConfig({ skipInternal: true })
      : config
    process.stdout.write(renderDump(projectConfig(template, built), dumpFormat))
    process.exitCode = EXIT_CODE.VALID
    return
  }

  process.exitCode = errors.length === 0 ? EXIT_CODE.VALID : EXIT_CODE.INVALID
  writeOutput(errors.length === 0 ? null : errors)
}

/**
 * Determines whether a value is one of the supported dump formats.
 *
 * @param {string} format The requested dump format.
 *
 * @returns {boolean} True when the format is supported.
 */
function isValidDumpFormat(format) {
  return Object.values(DUMP_FORMAT).includes(format)
}

/**
 * Projects the normalized values from a constructed `Config` onto the shape of
 * a template object. Only keys present in the template appear in the result,
 * so internal/derived `Config` fields can never leak into the output. Nested
 * plain objects are projected recursively; everything else is taken from the
 * source.
 *
 * @param {object} template The object whose keys define what to include (the
 * user's raw configuration for a plain dump, or the default-config universe for
 * a full dump).
 * @param {object} source The constructed `Config` to read normalized values
 * from.
 *
 * @returns {object} A nested plain configuration object.
 */
function projectConfig(template, source) {
  const out = {}
  for (const key of Object.keys(template)) {
    const templateValue = template[key]
    const sourceValue = source?.[key]
    if (isPlainObject(templateValue) === true && isPlainObject(sourceValue) === true) {
      out[key] = projectConfig(templateValue, sourceValue)
    } else {
      out[key] = sourceValue
    }
  }
  return out
}

/**
 * @param {*} value The value to test.
 *
 * @returns {boolean} True when `value` is a non-array, non-null object.
 */
function isPlainObject(value) {
  return value != null && typeof value === 'object' && Array.isArray(value) === false
}

/**
 * Serializes a configuration object as a re-loadable file in the requested
 * module format.
 *
 * @param {object} config The configuration object to serialize.
 * @param {string} format One of `cjs`, `esm`, or `json`.
 *
 * @returns {string} The serialized configuration, terminated by a newline.
 */
function renderDump(config, format) {
  const body = JSON.stringify(config, null, 2)
  switch (format) {
    case DUMP_FORMAT.JSON:
      return `${JSON.stringify({ config }, null, 2)}\n`
    case DUMP_FORMAT.ESM:
      return `export const config = ${body}\n`
    default:
      return `exports.config = ${body}\n`
  }
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
