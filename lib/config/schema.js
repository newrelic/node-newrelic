/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const Ajv = require('ajv/dist/2020')
const deriveEnvVarName = require('./derive-env-var-name.js')

const SCHEMA_DIR = path.join(__dirname, 'schemas')
const ROOT_SCHEMA_FILE = 'root.js'

let cached = null

/**
 * The cached, built schema state. Produced once by `build` and reused.
 *
 * @typedef {object} AgentConfigSchema
 * @property {object} schema The root schema object as provided to AJV. This
 * is not a realized schema.
 * @property {Function} validate The compiled AJV validation function. Used to
 * verify that data matches the schema.
 * @property {Function} resolveRef Resolves a `$ref` (a block `$id`) to the block
 * schema object it identifies, via AJV's registry.
 * @property {object|null} renderedSchema A fully realized copy of the schema
 * with every `$ref` inlined, suitable for JSON stringification. Built lazily on
 * first access to the `renderedSchema` getter; `null` until then.
 * @property {Map<string, {pathSegments: string[], node: object}>} envVarIndex
 * Maps each environment variable name to the config path (as segments) and
 * schema node it sets.
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

  // Where each block schema mounts in the root: `$id` -> the top-level property
  // key that `$ref`s it. Used to prefix a block's env var names as it is loaded.
  const mountKeyById = new Map()
  for (const [key, value] of Object.entries(root.properties || {})) {
    if (value && typeof value.$ref === 'string') {
      mountKeyById.set(value.$ref, key)
    }
  }

  // The env var index (env var name -> { pathSegments, node }) is assembled as
  // the schema files are loaded, rather than by a separate walk of the whole
  // schema afterward. Root's own top-level settings are indexed here; each
  // block's settings are indexed under its mount key as the block file loads.
  const envVarIndex = new Map()
  indexTerminalNodes({ node: root, prefix: [], index: envVarIndex })

  // `strict: false` keeps ajv from rejecting the schema's own vendor/annotation
  // keywords (e.g. x-newrelic-internal); we're validating config data, not the
  // schema itself.
  const ajv = new Ajv({ allErrors: true, strict: false })
  for (const file of fs.readdirSync(SCHEMA_DIR)) {
    if (file === ROOT_SCHEMA_FILE || !file.endsWith('.js')) {
      continue
    }
    const blockSchema = require(path.join(SCHEMA_DIR, file))
    ajv.addSchema(blockSchema)

    // Index this block's settings under the key that mounts it in the root.
    const mountKey = mountKeyById.get(blockSchema.$id)
    if (mountKey) {
      indexTerminalNodes({ node: blockSchema, prefix: [mountKey], index: envVarIndex })
    }
  }

  // Resolve a `$ref` (e.g. `attributes.js`) to its schema object using ajv's
  // registry, rather than maintaining a separate map. Refs match the block
  // `$id`s ajv keys its registry by.
  const resolveRef = (ref) => {
    const validator = ajv.getSchema(ref)
    return validator ? validator.schema : undefined
  }

  // The rendered schema (a full deep clone) is only needed by callers that
  // serialize the schema, so it is built lazily on first access.
  cached = {
    schema: root,
    validate: ajv.compile(root),
    resolveRef,
    renderedSchema: null,
    envVarIndex
  }
  return cached
}

/**
 * Whether a schema node is a terminal node (a settable value) rather than a
 * container of further properties. Only a node with a `properties` map is a
 * container; an object node without `properties` (e.g. a dictionary declared
 * via `additionalProperties`, such as `labels` or `error_collector.ignore_messages`)
 * is itself a settable value.
 *
 * @param {object} node The schema node.
 * @returns {boolean} True if the node is a terminal node.
 */
function isTerminalNode(node) {
  return node == null || node.properties === undefined
}

/**
 * Adds a schema's terminal nodes to the env var index, in place. Recurses
 * through the `node`'s own `properties` (a single schema file — root or a block
 * — without following `$ref`s; a `$ref` child is a mounted block and is indexed
 * when that block's own file is loaded). Each terminal node is keyed by its
 * explicit `x-newrelic-env-var` if declared, otherwise the name derived from its
 * path (the mount `prefix` plus its position within this schema).
 *
 * @param {object} params Function parameters.
 * @param {object} params.node The schema node to inspect.
 * @param {string[]} params.prefix Path segments this node is mounted under
 *   (`[]` for the root, `[mountKey]` for a block).
 * @param {Map<string, {pathSegments: string[], node: object}>} params.index The
 *   index to populate; mutated in place.
 */
function indexTerminalNodes({ node, prefix, index }) {
  if (!node || typeof node !== 'object') {
    return
  }
  for (const [key, child] of Object.entries(node.properties || {})) {
    // A `$ref` child mounts another block; that block indexes itself when its
    // file is loaded, so skip it here.
    if (child && typeof child.$ref === 'string') {
      continue
    }
    const pathSegments = [...prefix, key]
    if (isTerminalNode(child)) {
      const name = child['x-newrelic-env-var'] || deriveEnvVarName(key, prefix)
      if (index.has(name)) {
        throw new Error(
          `Ambiguous environment variable ${name}: maps to both ` +
            `${index.get(name).pathSegments.join('.')} and ${pathSegments.join('.')}`
        )
      }
      index.set(name, { pathSegments, node: child })
      continue
    }
    indexTerminalNodes({ node: child, prefix: pathSegments, index })
  }
}

// Keys stripped from an inlined block schema: they describe the block as a
// standalone document, not as an embedded subschema.
const INLINED_BLOCK_KEYS = new Set(['$schema', '$id'])

/**
 * Recursively deep-clones a schema node, replacing every `$ref` with the schema
 * it resolves to (whose own nested `$ref`s are likewise resolved). The result
 * is a single literal JSON Schema with no `$ref`s remaining.
 *
 * @param {*} node The schema node to render.
 * @param {Function} resolveRef Resolves a `$ref` string to its schema object.
 * @param {boolean} [inlined] True when rendering a block reached via `$ref`, so
 *   that its standalone-document keys ($schema/$id) are dropped.
 * @returns {*} The fully-rendered node.
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
  },

  /**
   * Resolves an environment variable name to the schema node it configures. The
   * name-to-node index is built once when the schema is built.
   *
   * @param {string} name An environment variable name (e.g.
   *   `NEW_RELIC_SLOW_SQL_MAX_SAMPLES`).
   * @returns {{pathSegments: string[], node: object}|undefined} The config path
   *   (as segments) and its schema node, or undefined when the name is not a
   *   recognized configuration variable.
   */
  resolveEnvVar(name) {
    return build().envVarIndex.get(name)
  }
}
