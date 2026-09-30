/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')

const schema = require('#agentlib/config/schema.js')

// The committed pre-compiled artifact, resolved relative to the schema module.
const GENERATED_FILE = require.resolve('#agentlib/config/schema.generated.js')

test('schema getter exposes the root schema', () => {
  const root = schema.schema
  assert.equal(typeof root, 'object')
  // A top-level scalar setting is defined inline on the root.
  assert.ok(root.properties.app_name, 'root exposes the app_name property')
  // Blocks are referenced rather than inlined on the raw root schema.
  assert.equal(root.properties.attributes.$ref, 'attributes.js')
})

test('validate compiles a working validator', async (t) => {
  await t.test('accepts an empty configuration', () => {
    assert.equal(schema.validate({}), true)
  })

  await t.test('rejects a value of the wrong type and records errors', () => {
    assert.equal(schema.validate({ port: [] }), false)
    assert.ok(Array.isArray(schema.validate.errors), 'exposes validation errors')
  })
})

test('resolveRef resolves block ids', async (t) => {
  await t.test('returns the block schema for a known $id', () => {
    const block = schema.resolveRef('attributes.js')
    assert.ok(block, 'resolves the attributes block')
    assert.ok(block.properties.enabled, 'block carries its own properties')
  })

  await t.test('returns undefined for an unknown $id', () => {
    assert.equal(schema.resolveRef('does-not-exist.js'), undefined)
  })
})

test('resolveEnvVar maps environment names to config paths', async (t) => {
  await t.test('resolves a recognized variable to its path and node', () => {
    const resolved = schema.resolveEnvVar('NEW_RELIC_LICENSE_KEY')
    assert.deepEqual(resolved.pathSegments, ['license_key'])
    assert.equal(resolved.node.type, 'string')
  })

  await t.test('resolves a variable that lives inside a block', () => {
    // `attributes.enabled` derives NEW_RELIC_ATTRIBUTES_ENABLED and is indexed
    // under its mount key, exercising the block-loading index path.
    const resolved = schema.resolveEnvVar('NEW_RELIC_ATTRIBUTES_ENABLED')
    assert.deepEqual(resolved.pathSegments, ['attributes', 'enabled'])
  })

  await t.test('returns undefined for an unrecognized variable', () => {
    assert.equal(schema.resolveEnvVar('NEW_RELIC_NOT_A_REAL_SETTING'), undefined)
  })
})

test('renderedSchema fully dereferences the schema', async (t) => {
  await t.test('inlines $ref blocks and drops their standalone-document keys', () => {
    const rendered = schema.renderedSchema
    const attributes = rendered.properties.attributes

    assert.equal(attributes.$ref, undefined, 'the $ref is replaced')
    assert.ok(attributes.properties, 'the block is inlined with its properties')
    assert.equal(attributes.$id, undefined, 'inlined block $id is stripped')
    assert.equal(attributes.$schema, undefined, 'inlined block $schema is stripped')
  })

  await t.test('preserves top-level scalar settings', () => {
    assert.ok(schema.renderedSchema.properties.app_name, 'app_name is retained')
  })

  await t.test('leaves no $ref anywhere in the rendered schema', () => {
    const json = JSON.stringify(schema.renderedSchema)
    assert.equal(json.includes('"$ref"'), false, 'no $ref remains after rendering')
  })

  await t.test('caches the rendered schema across accesses', () => {
    assert.equal(schema.renderedSchema, schema.renderedSchema)
  })
})

test('buildState builds directly from disk', async (t) => {
  await t.test('returns the schema state plus the ajv instance and ref map', () => {
    const state = schema.buildState()
    assert.equal(state.schema.properties.app_name !== undefined, true, 'exposes the root schema')
    assert.equal(typeof state.validate, 'function', 'exposes a compiled validator')
    assert.equal(state.validate({}), true, 'the validator works')
    assert.equal(typeof state.ajv.compile, 'function', 'exposes the live ajv instance')
    assert.ok(state.refs['attributes.js'], 'exposes the $id-to-schema map')
    assert.ok(state.envVarIndex.get('NEW_RELIC_LICENSE_KEY'), 'builds the env var index')
  })

  await t.test('forwards ajv options to the constructor', () => {
    // `code.source` makes ajv retain the generated validation source, which the
    // pre-compiled schema generator serializes; the default build does not.
    const state = schema.buildState({ code: { source: true } })
    assert.equal(state.ajv.opts.code.source, true, 'the option reached the ajv instance')
  })

  await t.test('does not share state with the cached build', () => {
    assert.notEqual(schema.buildState(), schema.buildState(), 'each call is independent')
  })
})

test('renderNode inlines a $ref against a resolver', () => {
  const block = { $id: 'block.js', $schema: 'x', type: 'object' }
  const resolveRef = (ref) => (ref === 'block.js' ? block : undefined)
  const rendered = schema.renderNode({ properties: { a: { $ref: 'block.js' } } }, resolveRef)

  assert.equal(rendered.properties.a.$ref, undefined, 'the $ref is replaced')
  assert.equal(rendered.properties.a.type, 'object', 'the resolved schema is inlined')
  assert.equal(rendered.properties.a.$id, undefined, 'inlined block $id is stripped')
  assert.equal(rendered.properties.a.$schema, undefined, 'inlined block $schema is stripped')
})

test('static config schema is in sync with the schema sources', async (t) => {
  const REMEDY =
    'The committed static config schema is stale. Run ' +
    '`npm run generate:config-validator` and commit lib/config/schema.generated.js.'

  await t.test('the committed artifact exists', () => {
    assert.equal(fs.existsSync(GENERATED_FILE), true, `lib/config/schema.generated.js is missing. ${REMEDY}`)
  })

  await t.test('regenerating produces no change', () => {
    // Generation is deterministic, so a fresh render must match the committed
    // file byte for byte. A mismatch means a schema block under
    // lib/config/schemas/ changed without the artifact being regenerated.
    const committed = fs.readFileSync(GENERATED_FILE, 'utf8')
    assert.equal(schema.render(), committed, REMEDY)
  })
})
