/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { schema, validate } = require('./schema')

/**
 * Validates a user-provided configuration object against the agent's config
 * JSON Schema (`schemas/root.js`). Throws when the configuration does not
 * conform, so callers can treat a bad configuration as fatal.
 *
 * The validator has ajv type coercion enabled, so this also mutates `config`
 * in place: basic scalar values are coerced to their schema type (e.g. the
 * string `'true'` becomes the boolean `true`, and `'8080'` becomes the integer
 * `8080`). The more complicated coercions (object/objectList/regex/allowList)
 * are not applied here.
 *
 * @param {object} config The configuration object to validate (e.g. the object
 *   passed to `initialize`, or the `config` export from a `newrelic.js` file).
 *   Mutated in place to coerce basic scalar types.
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
