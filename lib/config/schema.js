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
 * @typedef {object} AgentConfigSchema
 * @property {object} schema The root schema object that gets fed to AJV. This
 * is not a realized schema.
 * @property {Function} validate The compiled AJV schema instance. Used to
 * verify data matches the defined schema.
 * @property {Function} resolveRef Returns the schema identified by `$ref`
 * fields in the `schema`.
 * @property {object} renderedSchema A fully realized instance of the schema
 * object that can be JSON stringified and written to disk.
 */

/**
 * Loads the root schema and, lazily, compiles a reusable ajv validator. The
 * root schema references each config block as `<block>.js`; every block
 * schema in `schemas/` is registered with ajv so those refs resolve before root
 * is compiled. Reading the directory rather than a hardcoded list means new
 * block files are picked up automatically. Compiled once and cached.
 *
 * @returns {AgentConfigSchema} An object representing the schema.
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

  cached = {
    schema: root,
    validate: ajv.compile(root),
    resolveRef,
    renderedSchema: null
  }
  return cached
}

// Keys stripped from an inlined block schema: they describe the block as a
// standalone document, not as an embedded subschema.
const INLINED_BLOCK_KEYS = new Set(['$schema', '$id'])

/**
 * Recursively deep-clones a schema node, replacing every `$ref` with the schema
 * it resolves to (whose own nested `$ref`s are likewise resolved). The result
 * is a single literal JSON Schema with no `$ref`s remaining.
 *
 * @param {*} node the schema node to render.
 * @param {Function} resolveRef resolves a `$ref` string to its schema object.
 * @param {boolean} [inlined] true when rendering a block reached via `$ref`, so
 *   its standalone-document keys ($schema/$id) are dropped.
 * @returns {*} the fully-rendered node.
 */
function renderNode(node, resolveRef, inlined = false) {
  if (Array.isArray(node)) {
    return node.map((item) => renderNode(item, resolveRef))
  }
  if (!node || typeof node !== 'object') {
    return node
  }
  if (typeof node.$ref === 'string') {
    const target = resolveRef(node.$ref)
    if (!target) {
      throw new Error(`Cannot resolve schema $ref "${node.$ref}"`)
    }
    return renderNode(target, resolveRef, true)
  }

  const out = {}
  for (const [key, value] of Object.entries(node)) {
    if (inlined && INLINED_BLOCK_KEYS.has(key)) {
      continue
    }
    out[key] = renderNode(value, resolveRef)
  }
  return out
}

// `schema`, `validate`, `resolveRef`, and `renderedSchema` are lazily built on
// first access and then cached, so requiring this module does not read the
// filesystem or compile ajv until the schema is actually needed.
module.exports = {
  /**
   * The root schema object as it was provided to AJV.
   *
   * @returns {object} Plain object representing the root schema.
   */
  get schema() {
    return build().schema
  },

  /**
   * Function to validate data against the schema.
   *
   * @returns {Function} AJV compiled validator.
   */
  get validate() {
    return build().validate
  },

  /**
   * Function to resolve `$ref` identifiers in the root schema.
   *
   * @returns {Function} Reference resolver.
   */
  get resolveRef() {
    return build().resolveRef
  },

  /**
   * Fully realized JSON Schema object. AJV does not support returning such
   * an object.
   *
   * @see https://web.archive.org/web/20260527021555/https://ajv.js.org/faq.html#generating-schemas-with-resolved-references-ref
   *
   * @returns {object} JSON Schema
   */
  get renderedSchema() {
    const state = build()
    if (!state.renderedSchema) {
      state.renderedSchema = renderNode(state.schema, state.resolveRef)
    }
    return state.renderedSchema
  }
}
