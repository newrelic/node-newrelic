/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const schema = require('#agentlib/config/schema.js')

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
