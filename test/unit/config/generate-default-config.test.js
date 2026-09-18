/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { generateDefaultConfig, renderDefaults } = require('#agentlib/config/generate-default-config.js')

// A resolver stub for nodes that carry a `$ref`.
const noResolve = () => undefined

test('renderDefaults', async (t) => {
  await t.test('returns undefined for a non-object node', () => {
    assert.equal(renderDefaults(undefined, noResolve), undefined)
    assert.equal(renderDefaults(null, noResolve), undefined)
    assert.equal(renderDefaults('a string', noResolve), undefined)
  })

  await t.test('returns undefined when a $ref cannot be resolved', () => {
    assert.equal(renderDefaults({ $ref: 'missing.js' }, noResolve), undefined)
  })

  await t.test('returns the declared default for a leaf node', () => {
    assert.equal(renderDefaults({ type: 'boolean', default: true }, noResolve), true)
  })

  await t.test('recurses into object nodes, dropping properties without defaults', () => {
    const node = {
      type: 'object',
      properties: {
        a: { type: 'boolean', default: false },
        b: { type: 'string' } // no default -> omitted
      }
    }
    assert.deepEqual(renderDefaults(node, noResolve), { a: false })
  })
})

test('generateDefaultConfig produces the agent defaults', () => {
  const config = generateDefaultConfig({ skipCache: true })
  assert.equal(typeof config, 'object')
  // Values the schema cannot carry as static defaults are filled in.
  assert.equal(config.license_key, '')
  assert.equal(config.serverless_mode.enabled, false)
  assert.ok(config.logging.filepath.endsWith('newrelic_agent.log'))
})
