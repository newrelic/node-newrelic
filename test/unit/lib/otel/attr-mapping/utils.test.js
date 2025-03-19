/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { abstractMapper, attributesMapper } = require('#agentlib/otel/attr-mapping/utils.js')
const test = require('node:test')
const assert = require('node:assert')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.span = {
    attributes: {
      key: 'value',
      legacyKey: 'legacyValue'
    }
  }

  ctx.nr.attrs = ['key', 'legacyKey']
  ctx.nr.fn = () => {}
  ctx.nr.mappings = {
    key: {
      attrs: ['key'],
      mapping() {
        return ctx.nr.fn
      }
    },
    anotherKey: {
      attrs: ['anotherKey', 'legacyKey'],
      attrMapper({ span }) {
        return span
      }
    },
    onlyAttrs: {
      attrs: ['onlyAttrs']
    }
  }
})

test('should return value if span is passed into abstractMapper', (t) => {
  const { span, fn, attrs } = t.nr
  const { value, mapping } = abstractMapper({ span, fn, attrs })
  assert.equal(value, 'value')
  assert.deepEqual(mapping, {})
})

test('should not return value if attr is not found in attributes', (t) => {
  const { attrs } = t.nr
  const span = {
    attributes: {
      test: 'value'
    }
  }
  const { value, mapping } = abstractMapper({ span, attrs })
  assert.equal(value, undefined)
  assert.deepEqual(mapping, {})
})

test('should return mapping if fn is passed into abstractMapper with no span', (t) => {
  const { fn, attrs } = t.nr
  const { value, mapping } = abstractMapper({ fn, attrs })
  assert.equal(value, undefined)
  assert.deepEqual(mapping, {
    key: fn,
    legacyKey: fn
  })
})

test('should return empty mapping and value when fn nor span are passed into abstractMapper', () => {
  const { value, mapping } = abstractMapper()
  assert.equal(value, undefined)
  assert.deepEqual(mapping, {})
})

test('should return undefined mapper when a key does not exist on mapper', () => {
  const mapper = attributesMapper.bind({})
  const ret = mapper()
  assert.equal(ret, undefined)
})

test('should return value when span passed into attrMapper', (t) => {
  const { mappings, span } = t.nr
  const mapper = attributesMapper.bind(mappings)
  const { value, mapping } = mapper({ span, key: 'key' })
  assert.equal(value, 'value')
  assert.deepEqual(mapping, {})
})

test('should return mapping when span is not passed into attrMapper', (t) => {
  const { mappings, fn } = t.nr
  const mapper = attributesMapper.bind(mappings)
  const { value, mapping } = mapper({ key: 'key' })
  assert.equal(value, undefined)
  assert.deepEqual(mapping, { key: fn })
})

test('should return undefined mapping when span is not passed into attrMapper and no mapping exist for given key', (t) => {
  const { mappings } = t.nr
  const mapper = attributesMapper.bind(mappings)
  const { value, mapping } = mapper({ key: 'onlyAttrs' })
  assert.equal(value, undefined)
  assert.deepEqual(mapping, {})
})

test('should run attrMapper when exists for a given key', (t) => {
  const { mappings, span } = t.nr
  const mapper = attributesMapper.bind(mappings)
  const { value } = mapper({ key: 'anotherKey', span })
  assert.deepEqual(value, span)
})
