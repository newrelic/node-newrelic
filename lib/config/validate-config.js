/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Ajv = require('ajv/dist/2020')
const schema = require('./schemas/root.json')

// The schema is Draft 2020-12. `strict: false` keeps ajv from rejecting the
// schema's own vendor/annotation keywords; we're validating config data, not
// the schema itself. Compiled once at require time and reused for every call.
const ajv = new Ajv({ allErrors: true, strict: false })
const validate = ajv.compile(schema)

/**
 * Validates a user-provided configuration object against the agent's config
 * JSON Schema (`schemas/root.json`). Throws when the configuration does not
 * conform, so callers can treat a bad configuration as fatal.
 *
 * @param {object} config the configuration object to validate (e.g. the object
 *   passed to `initialize`, or the `config` export from a `newrelic.js` file).
 * @throws {Error} when `config` fails schema validation. The error message
 *   lists each validation failure.
 */
function validateConfig(config) {
  if (validate(config)) {
    return
  }

  const details = validate.errors
    .map((error) => {
      const location = error.instancePath || '<root>'
      return `  ${location} ${error.message}`
    })
    .join('\n')

  throw new Error(`New Relic configuration failed schema validation:\n${details}`)
}

module.exports = validateConfig
module.exports.schema = schema
