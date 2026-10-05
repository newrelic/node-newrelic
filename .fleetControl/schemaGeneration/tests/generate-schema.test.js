/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { prune, generateSchema, validateMetaSchema } = require('../generate-schema')

test('prune', async (t) => {
  await t.test('removes properties marked x-newrelic-internal', () => {
    const node = {
      type: 'object',
      properties: {
        keep: { type: 'string' },
        secret: { type: 'boolean', 'x-newrelic-internal': true }
      }
    }
    prune(node)
    assert.ok(node.properties.keep, 'user-facing property is kept')
    assert.equal('secret' in node.properties, false, 'internal property is removed')
  })

  await t.test('strips $id and non-env vendor keywords, keeps x-newrelic-env-var', () => {
    const node = {
      $id: 'block.js',
      type: 'object',
      properties: {
        setting: {
          type: 'string',
          'x-newrelic-env-var': 'NEW_RELIC_SETTING',
          'x-newrelic-coerce': 'object',
          'x-newrelic-sampler': true
        }
      }
    }
    prune(node)
    assert.equal(node.$id, undefined, '$id is stripped')
    const setting = node.properties.setting
    assert.equal(setting['x-newrelic-env-var'], 'NEW_RELIC_SETTING', 'env-var keyword is kept')
    assert.equal(setting['x-newrelic-coerce'], undefined, 'coerce keyword is stripped')
    assert.equal(setting['x-newrelic-sampler'], undefined, 'sampler keyword is stripped')
  })

  await t.test('recurses into nested keywords such as oneOf and items', () => {
    const node = {
      type: 'object',
      properties: {
        thing: {
          oneOf: [
            { type: 'string' },
            { type: 'object', $id: 'nested.js', properties: { inner: { type: 'string', 'x-newrelic-coerce': 'regex' } } }
          ],
          items: { type: 'object', $id: 'item.js' }
        }
      }
    }
    prune(node)
    const thing = node.properties.thing
    assert.equal(thing.oneOf[1].$id, undefined, '$id inside oneOf is stripped')
    assert.equal(thing.oneOf[1].properties.inner['x-newrelic-coerce'], undefined, 'nested coerce is stripped')
    assert.equal(thing.items.$id, undefined, '$id inside items is stripped')
  })
})

test('generateSchema', async (t) => {
  const schema = generateSchema()

  await t.test('produces a valid Draft 2020-12 schema document', () => {
    assert.equal(validateMetaSchema(schema), true)
  })

  await t.test('sets the published document metadata', () => {
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
    assert.equal(schema.title, 'New Relic Node.js Agent Configuration')
    assert.match(schema.description, /Generated from the agent config JSON Schema/)
    assert.deepEqual(schema.required, ['app_name', 'license_key'])
    assert.equal(schema.additionalProperties, true)
  })

  await t.test('excludes internal settings', () => {
    assert.equal('ssl' in schema.properties, false, 'ssl is excluded')
    assert.equal('agent_control' in schema.properties, false, 'agent_control is excluded')
  })

  await t.test('retains user-facing settings with their descriptions', () => {
    assert.equal(schema.properties.license_key.type, 'string')
    assert.ok(schema.properties.license_key.description, 'descriptions are carried through')
    assert.ok(schema.properties.attributes.properties.enabled, 'blocks are inlined')
  })

  await t.test('keeps x-newrelic-env-var and strips other vendor keywords', () => {
    const json = JSON.stringify(schema)
    assert.ok(json.includes('x-newrelic-env-var'), 'env-var keyword is present')
    assert.equal(json.includes('x-newrelic-internal'), false, 'no internal keyword remains')
    assert.equal(json.includes('x-newrelic-coerce'), false, 'no coerce keyword remains')
    assert.equal(json.includes('x-newrelic-sampler'), false, 'no sampler keyword remains')
    assert.equal(json.includes('"$id"'), false, 'no $id remains')
  })
})
