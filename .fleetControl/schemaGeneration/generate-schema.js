/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')
const Ajv2020 = require('ajv/dist/2020')

const defaultConfig = require('../../lib/config/default')
const pkgInstrumentation = require('../../lib/config/build-instrumentation-config')
const formatters = require('../../lib/config/formatters')

const REPO_ROOT = path.join(__dirname, '..', '..')
const DEFAULT_CONFIG_SOURCE = path.join(REPO_ROOT, 'lib', 'config', 'default.js')
const SAMPLERS_SOURCE = path.join(REPO_ROOT, 'lib', 'config', 'samplers.js')
const SCHEMA_PATH = path.join(__dirname, '..', 'schemas', 'config.json')

// Replaces a leaf's schema outright, for shapes formatter/default can't reveal.
const TYPE_OVERRIDES = {
  // Custom formatter also accepts a delimited string, not just an array.
  app_name: arrayOrDelimitedString([]),
  // Real default is `process.cwd()`-relative, not a fixed literal.
  'logging.filepath': { type: 'string' },
  // Real default is computed from an env var, not a fixed literal — and unlike
  // logging.filepath, the source comment doesn't explain the auto-detection, so
  // the override supplies its own description instead of just dropping `default`.
  'serverless_mode.enabled': {
    type: 'boolean',
    description:
      'Specifies whether the agent will be used to monitor serverless functions ' +
      '(e.g. AWS Lambda). Defaults to true when the AWS_LAMBDA_FUNCTION_NAME ' +
      'environment variable is present, false otherwise.'
  },
  // Real default ('') is a placeholder, not a usable value — drop it and require a real one.
  license_key: { type: 'string', minLength: 1 },
  // Accepted as either a string or a number in practice (see New Relic's own
  // account_id/trusted_account_key test fixtures); the generic null-default
  // fallback only ever guesses 'string'.
  trusted_account_key: { type: ['string', 'number', 'null'], default: null },
  primary_application_id: { type: ['string', 'number', 'null'], default: null },
  account_id: { type: ['string', 'number', 'null'], default: null },
  // Source comment states both limits explicitly; formatter/default alone don't reveal them.
  labels: {
    type: 'object',
    propertyNames: { maxLength: 255 },
    additionalProperties: { type: 'string', maxLength: 255 },
    maxProperties: 64,
    default: {}
  },
  // Source comment states an explicit maximum of 4,096; formatter/default alone don't reveal it.
  'attributes.value_size_limit': { type: 'integer', default: 256, maximum: 4096 },
  // Source comment states an explicit range; formatter/default alone don't reveal it.
  'distributed_tracing.sampler.adaptive_sampling_target': { type: 'integer', default: 10, minimum: 1, maximum: 120 },
  'transaction_tracer.transaction_threshold': { type: ['number', 'string'], default: 'apdex_f' }
}

// Most enums come from the `allowList` formatter automatically; this covers the rest.
const ENUM_OVERRIDES = {}

// Excludes a path and everything nested under it. The schema is scoped to public-facing
// config only — settings a user is meant to set - this excludes the rest.
const EXCLUDE_KEYS = new Set([
  'agent_control', // Fleet Control sets this itself.
  'logging.diagnostics',
  'infinite_tracing.trace_observer.insecure',
  'ssl' // no-op: the formatter always forces true regardless of input.
])

function arrayOrDelimitedString(defaultValue) {
  const schema = {
    anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }]
  }
  if (defaultValue !== undefined) {
    schema.default = defaultValue
  }
  return schema
}

// Maps dotted.path -> { description, block }, by tracking indentation
// (not braces) so a leaf's own formatter:/default: lines can't be mistaken
// for nested properties — they get pushed then popped like any sibling.
// `block` is that leaf's raw source, for facts only source text has (e.g.
// allowList's bound arguments, which aren't inspectable on the function).
function indexJSDocComments(sourceText) {
  const lines = sourceText.split('\n')
  const index = new Map()
  const stack = []
  const comment = { active: false, lines: [], pending: '' }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (consumeCommentLine(comment, trimmed)) {
      continue
    }

    const match = /^(\s*)([A-Za-z_]\w*)\s*:/.exec(line)
    if (!match) {
      comment.pending = '' // a comment only documents the key right below it
      continue
    }

    recordProperty({ index, stack, lines, lineIndex: i, match, description: comment.pending })
    comment.pending = ''
  }

  return index
}

function consumeCommentLine(comment, trimmed) {
  if (!comment.active) {
    if (!trimmed.startsWith('/**')) {
      return false
    }
    // A one-line /** ... */ closes here too, or it'd swallow everything after it.
    const singleLine = /^\/\*\*(.*)\*\/$/.exec(trimmed)
    if (singleLine) {
      comment.pending = singleLine[1].trim()
      return true
    }
    comment.active = true
    comment.lines = []
    return true
  }

  if (trimmed.startsWith('*/')) {
    comment.active = false
    comment.pending = comment.lines.join(' ').replace(/\s+/g, ' ').trim()
    return true
  }

  const text = trimmed.replace(/^\*\s?/, '')
  if (text && !text.startsWith('@')) {
    comment.lines.push(text)
  }
  return true
}

function recordProperty({ index, stack, lines, lineIndex, match, description }) {
  const indent = match[1].length
  const key = match[2]

  while (stack.length && stack[stack.length - 1].indent >= indent) {
    stack.pop()
  }

  const pathKey = [...stack.map((entry) => entry.key), key].join('.')
  index.set(pathKey, { description, block: collectBlock(lines, lineIndex, indent) })
  stack.push({ indent, key })
}

function collectBlock(lines, startIndex, indent) {
  const block = [lines[startIndex]]
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') {
      continue
    }
    const lineIndent = line.length - line.trimStart().length
    if (lineIndent <= indent) {
      break
    }
    block.push(line)
  }
  return block.join('\n')
}

// bind() doesn't expose its bound args, so scrape them from source text instead.
function extractAllowListEnum(block) {
  const call = /allowList\.bind\(\s*null\s*,\s*(\[[^\]]*\])\)/.exec(block)
  if (!call) {
    return []
  }

  const values = []
  const stringLiteral = /'([^']*)'/g
  let match
  while ((match = stringLiteral.exec(call[1])) !== null) {
    values.push(match[1])
  }
  return values
}

// A non-literal default gets re-evaluated on every run (see logging.filepath).
const LITERAL_DEFAULT = /^(null|true|false|-?\d|'|"|\[|\{)/

function hasComputedDefault(block) {
  const match = /default:\s*(\S+)/.exec(block)
  return Boolean(match) && !LITERAL_DEFAULT.test(match[1])
}

function inferFromLiteral(defaultValue, schema) {
  if (defaultValue === null) {
    schema.type = ['string', 'null']
    return
  }
  if (defaultValue === undefined) {
    schema.type = 'string'
    return
  }
  if (Array.isArray(defaultValue)) {
    schema.type = 'array'
    schema.items = {}
    return
  }

  const type = typeof defaultValue
  if (type === 'boolean' || type === 'number' || type === 'string') {
    schema.type = type
    return
  }
  schema.type = 'object'
  schema.additionalProperties = true
}

function isLeafDefinition(node) {
  return (
    Object.prototype.hasOwnProperty.call(node, 'env') ||
    Object.prototype.hasOwnProperty.call(node, 'default')
  )
}

function makeProperty(pathStr, flatKey, value, sourceEntry, ctx) {
  const overridden = applyOverrides(pathStr, flatKey, value, ctx)
  if (overridden) {
    return withDescription(overridden, sourceEntry, ctx, pathStr)
  }

  if (typeof value === 'string') {
    return withDescription({ type: 'string', default: value }, sourceEntry, ctx, pathStr)
  }

  const block = (sourceEntry && sourceEntry.block) || ''
  if (hasComputedDefault(block)) {
    ctx.suspiciousDefaults.push(pathStr)
  }

  const schema = inferSchema(value, block)
  if (value.default !== undefined) {
    schema.default = value.default
  }

  return withDescription(schema, sourceEntry, ctx, pathStr)
}

// Overrides read from ctx, not the module constants, so tests can use synthetic maps.
function applyOverrides(pathStr, flatKey, value, ctx) {
  if (ctx.typeOverrides[pathStr]) {
    return { ...ctx.typeOverrides[pathStr] }
  }

  const enumValues = ctx.enumOverrides[pathStr] || ctx.enumOverrides[flatKey]
  if (!enumValues) {
    return null
  }

  const schema = { type: 'string', enum: enumValues }
  const literalDefault = typeof value === 'string' ? value : value?.default
  if (literalDefault !== undefined && enumValues.includes(literalDefault)) {
    schema.default = literalDefault
  }
  return schema
}

function inferSchema(value, block) {
  const schema = {}
  const formatter = value.formatter

  if (formatter === formatters.boolean) {
    schema.type = 'boolean'
  } else if (formatter === formatters.int) {
    schema.type = 'integer'
  } else if (formatter === formatters.float) {
    schema.type = 'number'
  } else if (formatter === formatters.array) {
    schema.type = 'array'
    schema.items = { type: 'string' }
  } else if (formatter === formatters.objectList) {
    schema.type = 'array'
    schema.items = {}
  } else if (formatter === formatters.object) {
    schema.type = 'object'
    schema.additionalProperties = true
  } else if (formatter === formatters.regex) {
    schema.type = 'string'
    schema.description = 'Must be a valid regular expression.'
  } else if (formatter && formatter.name === 'bound allowList') {
    schema.type = 'string'
    const allowed = extractAllowListEnum(block)
    if (allowed.length) {
      schema.enum = allowed
    }
  } else {
    inferFromLiteral(value.default, schema)
  }

  return schema
}

function withDescription(schema, sourceEntry, ctx, pathStr) {
  const description = sourceEntry && sourceEntry.description
  if (description) {
    schema.description = schema.description || description // a formatter hint wins if set
  } else {
    ctx.missingDescriptions.push(pathStr)
  }
  return schema
}

function isExcluded(pathStr, excludeKeys) {
  for (const excluded of excludeKeys) {
    if (pathStr === excluded || pathStr.startsWith(`${excluded}.`)) {
      return true
    }
  }
  return false
}

// Package names change every release, so this is one shape via
// additionalProperties instead of 100+ enumerated properties.
function instrumentationSchema(sourceEntry) {
  return {
    type: 'object',
    description:
      (sourceEntry && sourceEntry.description) || 'Per-module instrumentation toggles.',
    properties: {},
    additionalProperties: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    }
  }
}

// additionalProperties: true is deliberate on every object node: a schema
// generated from an older default.js shouldn't reject a newer agent's config.
function walk(value, pathParts, ctx) {
  const pathStr = pathParts.join('.')
  if (isExcluded(pathStr, ctx.excludeKeys)) {
    return null
  }

  if (value === pkgInstrumentation) {
    return instrumentationSchema(ctx.commentIndex.get(pathStr))
  }
  if (typeof value !== 'object' || value === null) {
    return makeProperty(pathStr, pathParts[pathParts.length - 1], value, ctx.commentIndex.get(pathStr), ctx)
  }
  if (isLeafDefinition(value)) {
    return makeProperty(pathStr, pathParts[pathParts.length - 1], value, ctx.commentIndex.get(pathStr), ctx)
  }

  const properties = {}
  for (const [key, child] of Object.entries(value)) {
    const schema = walk(child, [...pathParts, key], ctx)
    if (schema) {
      properties[key] = schema
    }
  }

  const sourceEntry = ctx.commentIndex.get(pathStr)
  const group = { type: 'object', properties, additionalProperties: true }
  return withDescription(group, sourceEntry, ctx, pathStr)
}

// root/remote_parent_sampled/remote_parent_not_sampled are spread into
// distributed_tracing.sampler rather than written there directly, so their
// comments live under their own bare names in a different file — reindex
// them under the dotted path `walk` actually looks them up by.
function mergeSamplerDescriptions(commentIndex, samplerCommentIndex) {
  const prefixes = ['distributed_tracing.sampler', 'distributed_tracing.sampler.partial_granularity']
  for (const key of ['root', 'remote_parent_sampled', 'remote_parent_not_sampled']) {
    const entry = samplerCommentIndex.get(key)
    if (!entry) {
      continue
    }
    for (const prefix of prefixes) {
      commentIndex.set(`${prefix}.${key}`, entry)
    }
  }
}

// Every input defaults to the real thing, so tests can pass synthetic ones instead.
function generateSchema({
  definition = defaultConfig.definition(),
  defaultConfigSourceText = fs.readFileSync(DEFAULT_CONFIG_SOURCE, 'utf8'),
  samplersSourceText = fs.readFileSync(SAMPLERS_SOURCE, 'utf8'),
  excludeKeys = EXCLUDE_KEYS,
  typeOverrides = TYPE_OVERRIDES,
  enumOverrides = ENUM_OVERRIDES
} = {}) {
  const commentIndex = indexJSDocComments(defaultConfigSourceText)
  mergeSamplerDescriptions(commentIndex, indexJSDocComments(samplersSourceText))

  const ctx = {
    commentIndex,
    missingDescriptions: [],
    suspiciousDefaults: [],
    excludeKeys,
    typeOverrides,
    enumOverrides
  }

  const properties = {}
  for (const [key, value] of Object.entries(definition)) {
    const schema = walk(value, [key], ctx)
    if (schema) {
      properties[key] = schema
    }
  }

  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'New Relic Node.js Agent Configuration',
    description:
      "Configuration accepted by the New Relic Node.js agent's config file " +
      '(newrelic.js, newrelic.cjs, or newrelic.mjs), and by the equivalent NEW_RELIC_* ' +
      'environment variables. Generated from lib/config/default.js; regenerate with ' +
      '`node .fleetControl/schemaGeneration/generate-schema.js` after changing that file.',
    type: 'object',
    properties,
    required: ['app_name', 'license_key'],
    additionalProperties: true
  }

  return { schema, missingDescriptions: ctx.missingDescriptions, suspiciousDefaults: ctx.suspiciousDefaults }
}

// ajv bundles the meta-schema itself — no network round-trip to json-schema.org.
function validateMetaSchema(schema) {
  const ajv = new Ajv2020({ strict: false })
  const valid = ajv.validateSchema(schema)
  if (valid) {
    console.log('Meta-schema validation passed (Draft 2020-12)')
  } else {
    console.error('Meta-schema validation FAILED:')
    for (const error of ajv.errors) {
      console.error(`  ${ajv.errorsText([error])}`)
    }
  }
  return valid
}

function main() {
  const { schema, missingDescriptions, suspiciousDefaults } = generateSchema()

  if (!validateMetaSchema(schema)) {
    process.exitCode = 2
    return
  }

  const previous = fs.existsSync(SCHEMA_PATH) ? fs.readFileSync(SCHEMA_PATH, 'utf8') : null
  const next = `${JSON.stringify(schema, null, 2)}\n`

  fs.mkdirSync(path.dirname(SCHEMA_PATH), { recursive: true })
  fs.writeFileSync(SCHEMA_PATH, next)
  console.log(`Wrote ${SCHEMA_PATH}`)

  if (missingDescriptions.length) {
    console.warn(
      `\n${missingDescriptions.length} setting(s) had no source comment and were written ` +
        'without a description. Check these against docs.newrelic.com and fill in ' +
        'lib/config/default.js:'
    )
    for (const settingPath of missingDescriptions) {
      console.warn(`  - ${settingPath}`)
    }
  }

  if (suspiciousDefaults.length) {
    console.warn(
      `\n${suspiciousDefaults.length} setting(s) have a computed default (not a literal) in ` +
        'lib/config/default.js. The value baked into config.json below reflects whatever it ' +
        'evaluated to on this machine, right now — add a corrected entry to TYPE_OVERRIDES:'
    )
    for (const settingPath of suspiciousDefaults) {
      console.warn(`  - ${settingPath}`)
    }
  }

  if (previous === null) {
    console.log('\nFirst run — schema created.')
    process.exitCode = 0
  } else if (previous !== next) {
    console.log('\nSchema changed.')
    process.exitCode = 1
  } else {
    console.log('\nNo schema changes.')
    process.exitCode = 0
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  arrayOrDelimitedString,
  indexJSDocComments,
  extractAllowListEnum,
  hasComputedDefault,
  inferFromLiteral,
  isLeafDefinition,
  makeProperty,
  applyOverrides,
  inferSchema,
  withDescription,
  isExcluded,
  instrumentationSchema,
  mergeSamplerDescriptions,
  walk,
  generateSchema,
  validateMetaSchema,
  TYPE_OVERRIDES,
  ENUM_OVERRIDES,
  EXCLUDE_KEYS
}
