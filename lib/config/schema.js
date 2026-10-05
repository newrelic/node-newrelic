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
 * schema object it identifies.
 * @property {object} renderedSchema A fully realized copy of the schema with
 * every `$ref` inlined, suitable for JSON stringification.
 * @property {Map<string, {pathSegments: string[], node: object}>} envVarIndex
 * Maps each environment variable name to the config path (as segments) and
 * schema node it sets.
 */

/**
 * Loads the pre-compiled schema artifact (`schema.generated.js`) and adapts it
 * into the schema state. The artifact is committed to the repo and ships with
 * the package, so obtaining the validator is a plain require — no reading and
 * compiling of the `schemas/` files at runtime. It is generated with
 * `npm run generate:config-validator`; the drift test in
 * `test/unit/config/schema.test.js` keeps it in sync with the schema sources.
 * Compiled once and cached.
 *
 * @returns {AgentConfigSchema} An object representing the schema.
 */
function build() {
  if (cached) {
    return cached
  }

  const prebuilt = require('./schema.generated.js')
  cached = {
    schema: prebuilt.schema,
    validate: prebuilt.validate,
    resolveRef: (ref) => prebuilt.refs[ref],
    renderedSchema: prebuilt.renderedSchema,
    envVarIndex: new Map(Object.entries(prebuilt.envVarIndex))
  }
  return cached
}

/**
 * Builds the schema state from disk: loads the root schema, registers every
 * block schema in `schemas/` with a fresh ajv instance, compiles the validator,
 * and assembles the env var index. This is the from-scratch build the runtime
 * `build` normally avoids by loading the pre-compiled artifact; it is used to
 * *produce* that artifact and to measure the cold disk-build cost. It returns
 * the live `ajv` instance and the `$id`-to-schema map alongside the public
 * state. `render` (and thus the generator) calls it with
 * `{ code: { source: true } }` so it can emit standalone validator code and
 * embed the ref map, reusing this single disk walk rather than duplicating it.
 *
 * @param {object} [ajvOptions] Extra options merged into the ajv constructor
 *   options (e.g. `{ code: { source: true } }` for standalone codegen).
 * @returns {object} An `AgentConfigSchema` extended with two build-only fields:
 *   `ajv` (the live ajv instance) and `refs` (the `$id`-to-block-schema map).
 */
function buildState(ajvOptions = {}) {
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
  //
  // `coerceTypes: true` lets ajv coerce basic scalar types
  // (boolean/integer/number) in place during validation, so a passed config
  // value like `high_security: 'true'` becomes `true` rather than failing the
  // `type: boolean` check. Coercion happens within the same validation walk, so
  // there is no second parse. The more complicated coercions
  // (object/objectList/regex/allowList) are not handled here; those remain the
  // job of the formatters applied to environment variables in
  // `apply-environment-overrides.js`.
  const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: true, ...ajvOptions })

  // Alongside ajv's registry, keep a plain `$id` -> block schema map. ajv's
  // registry is enough for `resolveRef` at runtime, but the generator needs a
  // serializable map to embed in the prebuilt artifact.
  const refs = {}
  for (const file of fs.readdirSync(SCHEMA_DIR)) {
    if (file === ROOT_SCHEMA_FILE || !file.endsWith('.js')) {
      continue
    }
    const blockSchema = require(path.join(SCHEMA_DIR, file))
    ajv.addSchema(blockSchema)
    refs[blockSchema.$id] = blockSchema

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
  return {
    schema: root,
    validate: ajv.compile(root),
    resolveRef,
    renderedSchema: null,
    envVarIndex,
    ajv,
    refs
  }
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

// These keys are required in a valid JSON Schema document, and so are present
// in all of the narrow configuration block schemas. When those schemas are
// inlined into the fully rendered schema, these keys need to be removed from
// the subschema so that the rendered schema is correct.
const INLINED_BLOCK_KEYS = new Set(['$schema', '$id'])

/**
 * Recursively deep-clones a schema node, replacing every `$ref` with the schema
 * it resolves to (whose own nested `$ref`s are likewise resolved). The result
 * is a single literal JSON Schema with no `$ref`s remaining.
 *
 * @param {*} node The schema node to render.
 * @param {Function} resolveRef Resolves a `$ref` string to its schema object.
 * @param {boolean} [inlined] True when rendering a block reached via `$ref`, so
 * that its standalone-document keys ($schema/$id) are dropped.
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

/**
 * Serializes an env-var index (a `Map`) to a plain object suitable for JSON
 * embedding in the pre-compiled artifact: `{ [name]: { pathSegments, node } }`.
 *
 * @param {Map<string, {pathSegments: string[], node: object}>} envVarIndex The
 *   env-var index to serialize.
 * @returns {object} The env-var index as a plain object.
 */
function serializeEnvVarIndex(envVarIndex) {
  const index = {}
  for (const [name, entry] of envVarIndex) {
    index[name] = { pathSegments: entry.pathSegments, node: entry.node }
  }
  return index
}

/**
 * Builds the full contents of the pre-compiled artifact
 * (`lib/config/schema.generated.js`) as a string, without writing it. The
 * generator (`bin/generate-config-validator.js`) writes the return value to
 * disk; the drift test regenerates in-memory and byte-compares it against the
 * committed file. Because it drives `buildState`/`renderNode` directly, the
 * emitted artifact stays in lockstep with the runtime build.
 *
 * @returns {string} The complete generated-module source.
 */
function render() {
  const standaloneCode = require('ajv/dist/standalone').default
  // buildState reads the schema from disk directly — it does not consult the
  // module cache or any existing artifact — so this always reflects the current
  // sources. `code.source` makes ajv emit standalone, dependency-inlined
  // validation code.
  const state = buildState({ code: { source: true, esm: false } })
  const validatorCode = standaloneCode(state.ajv, state.validate)
  const renderedSchema = renderNode(state.schema, state.resolveRef)

  const embedded = {
    schema: state.schema,
    refs: state.refs,
    renderedSchema,
    envVarIndex: serializeEnvVarIndex(state.envVarIndex)
  }

  const banner = [
    '/*',
    ' * Copyright 2026 New Relic Corporation. All rights reserved.',
    ' * SPDX-License-Identifier: Apache-2.0',
    ' */',
    "'use strict'\n",
    '/*',
    ' * GENERATED FILE — DO NOT EDIT.',
    ' *',
    ' * Produced by `npm run generate:config-validator`',
    ' * (bin/generate-config-validator.js) from the agent config JSON Schema in',
    ' * lib/config/schemas/. It is a static, pre-compiled form of the schema so',
    ' * that lib/config/schema.js can obtain the validator via a plain require',
    ' * instead of reading and compiling the schema on every process start.',
    ' */\n'
  ].join('\n')

  // The standalone validator is a self-contained CommonJS module string. We
  // evaluate it in its own module scope so its top-level `require`/`exports`
  // don't collide with ours, then expose the result as `validate`.
  const body = [
    'const { schema, refs, renderedSchema, envVarIndex } = ',
    JSON.stringify(embedded, null, 2) + '\n\n',
    'const validate = (function () {',
    '  const module = { exports: {} }',
    '  const exports = module.exports',
    '  ;(function (module, exports, require) {',
    validatorCode.split('\n').map((l) => (l.length ? '    ' + l : l)).join('\n'),
    '\n  })(module, exports, require)',
    '  return module.exports',
    '})()\n',
    'module.exports = { schema, validate, refs, renderedSchema, envVarIndex }'
  ].join('\n')

  return banner + body
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
    return build().renderedSchema
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
  },

  /**
   * Builds the schema state directly from disk, bypassing the module cache and
   * the prebuilt artifact. Exposed so callers that need a cold, disk-only build
   * (e.g. the config benchmark's disk cold-build case) can obtain one without
   * hiding the artifact or clearing the require cache.
   *
   * @param {object} [ajvOptions] Extra options merged into the ajv constructor.
   * @returns {object} An `AgentConfigSchema` extended with `ajv` (the live ajv
   *   instance) and `refs` (the `$id`-to-block-schema map).
   */
  buildState,

  /**
   * Renders a schema node with every `$ref` inlined.
   *
   * @param {*} node The schema node to render.
   * @param {Function} resolveRef Resolves a `$ref` string to its schema object.
   * @returns {*} The fully-rendered node.
   */
  renderNode,

  /**
   * Renders the full contents of the pre-compiled artifact
   * (`lib/config/schema.generated.js`) as a string, without writing it. Used by
   * the generator to write the file and by the drift test to byte-compare a
   * fresh render against the committed artifact.
   *
   * @returns {string} The complete generated-module source.
   */
  render
}
