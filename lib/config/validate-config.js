/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('fs')
const path = require('path')
const Ajv = require('ajv/dist/2020')

const SCHEMA_DIR = path.join(__dirname, 'schemas')
const ROOT_SCHEMA_FILE = 'root.js'
const schema = require('./schemas/root.js')

// The schema is Draft 2020-12. `strict: false` keeps ajv from rejecting the
// schema's own vendor/annotation keywords; we're validating config data, not
// the schema itself. Compiled once at require time and reused for every call.
const ajv = new Ajv({ allErrors: true, strict: false })

// root.js references each config block as `./<block>.js`; register every block
// schema in the directory (by its `$id`) so those refs resolve before we
// compile root. Reading the directory rather than a hardcoded list means new
// block files are picked up automatically.
for (const file of fs.readdirSync(SCHEMA_DIR)) {
  if (file === ROOT_SCHEMA_FILE || !file.endsWith('.js')) {
    continue
  }
  ajv.addSchema(require(path.join(SCHEMA_DIR, file)))
}

const validate = ajv.compile(schema)

/**
 * Validates a user-provided configuration object against the agent's config
 * JSON Schema (`schemas/root.js`). Throws when the configuration does not
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
