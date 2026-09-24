/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')
const Ajv2020 = require('ajv/dist/2020')

const { renderedSchema } = require('../../lib/config/schema')

const SCHEMA_PATH = path.join(__dirname, '..', 'schemas', 'config.json')

const TITLE = 'New Relic Node.js Agent Configuration'
const DESCRIPTION =
  "Configuration accepted by the New Relic Node.js agent's config file " +
  '(newrelic.js, newrelic.cjs, or newrelic.mjs), and by the equivalent NEW_RELIC_* ' +
  'environment variables. Generated from the agent config JSON Schema ' +
  '(lib/config/schemas/); regenerate with ' +
  '`node .fleetControl/schemaGeneration/generate-schema.js`.'

// Vendor keywords to strip when publishing config.json. `x-newrelic-env-var` is
// intentionally kept: it documents the environment variable that sets a setting.
const STRIPPED_KEYWORDS = new Set([
  '$id',
  'x-newrelic-coerce',
  'x-newrelic-sampler'
])

/**
 * Removes internal (non-user-facing) settings from a `properties` map and
 * recursively prunes the survivors.
 *
 * @param {object} properties A schema node's `properties` map.
 */
function pruneProperties(properties) {
  for (const [key, child] of Object.entries(properties)) {
    if (child && child['x-newrelic-internal'] === true) {
      delete properties[key]
      continue
    }
    prune(child)
  }
}

/**
 * Recursively prunes a schema node for publication: removes children marked
 * `x-newrelic-internal` (settings that are not user-facing), and strips vendor
 * keywords that should not appear in the published artifact. Mutates in place —
 * this generator is a standalone process, so there is no shared state to
 * protect.
 *
 * @param {*} node The schema node to prune.
 * @returns {*} The same node, pruned.
 */
function prune(node) {
  if (Array.isArray(node)) {
    node.forEach(prune)
    return node
  }
  if (!node || typeof node !== 'object') {
    return node
  }

  for (const keyword of STRIPPED_KEYWORDS) {
    delete node[keyword]
  }

  // Recurse into every object-valued keyword. `properties` gets internal-node
  // filtering; everything else (items, oneOf members, additionalProperties,
  // etc.) is pruned so nested vendor keywords are stripped too.
  for (const [key, value] of Object.entries(node)) {
    if (!value || typeof value !== 'object') {
      continue
    }
    if (key === 'properties') {
      pruneProperties(value)
    } else {
      prune(value)
    }
  }

  return node
}

/**
 * Builds the published config schema from the agent's fully-rendered config
 * JSON Schema. The rendered schema already carries every setting's type,
 * default, constraints, and description, so this only prunes internal settings
 * and vendor keywords and applies the published document's title/description.
 *
 * @returns {object} The config.json schema object.
 */
function generateSchema() {
  const source = prune(renderedSchema)

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: TITLE,
    description: DESCRIPTION,
    type: 'object',
    properties: source.properties,
    required: ['app_name', 'license_key'],
    additionalProperties: true
  }
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
  const schema = generateSchema()

  if (!validateMetaSchema(schema)) {
    process.exitCode = 1
    return
  }

  const previous = fs.existsSync(SCHEMA_PATH) ? fs.readFileSync(SCHEMA_PATH, 'utf8') : null
  const next = `${JSON.stringify(schema, null, 2)}\n`

  fs.mkdirSync(path.dirname(SCHEMA_PATH), { recursive: true })
  fs.writeFileSync(SCHEMA_PATH, next)
  console.log(`Wrote ${SCHEMA_PATH}`)

  if (previous === null) {
    console.log('\nFirst run — schema created.')
  } else if (previous !== next) {
    console.log('\nSchema changed.')
  } else {
    console.log('\nNo schema changes.')
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  prune,
  generateSchema,
  validateMetaSchema
}
