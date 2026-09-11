/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const Ajv = require('ajv/dist/2020')

const SCHEMA_DIR = path.join(__dirname, 'schemas')
const ROOT_SCHEMA_FILE = 'root.js'

let cached = null

/**
 * Loads the root schema and, lazily, compiles a reusable ajv validator. The
 * root schema references each config block as `<block>.js`; every block
 * schema in `schemas/` is registered with ajv so those refs resolve before root
 * is compiled. Reading the directory rather than a hardcoded list means new
 * block files are picked up automatically. Compiled once and cached.
 *
 * @returns {{ schema: object, validate: Function, resolveRef: Function }} the
 *   root schema, its compiled ajv validate function, and a `$ref` resolver
 *   backed by ajv's own schema registry.
 */
function build() {
  if (cached) {
    return cached
  }

  const root = require('./schemas/root.js')

  // `strict: false` keeps ajv from rejecting the schema's own vendor/annotation
  // keywords (e.g. x-newrelic-internal); we're validating config data, not the
  // schema itself.
  const ajv = new Ajv({ allErrors: true, strict: false })
  for (const file of fs.readdirSync(SCHEMA_DIR)) {
    if (file === ROOT_SCHEMA_FILE || !file.endsWith('.js')) {
      continue
    }
    ajv.addSchema(require(path.join(SCHEMA_DIR, file)))
  }

  // Resolve a `$ref` (e.g. `attributes.js`) to its schema object using ajv's
  // registry, rather than maintaining a separate map. Refs match the block
  // `$id`s ajv keys its registry by.
  const resolveRef = (ref) => {
    const validator = ajv.getSchema(ref)
    return validator ? validator.schema : undefined
  }

  cached = { schema: root, validate: ajv.compile(root), resolveRef }
  return cached
}

// `schema`, `validate`, and `resolveRef` are lazily built on first access and
// then cached, so requiring this module does not read the filesystem or compile
// ajv until the schema is actually needed.
module.exports = {
  get schema() {
    return build().schema
  },
  get validate() {
    return build().validate
  },
  get resolveRef() {
    return build().resolveRef
  }
}
