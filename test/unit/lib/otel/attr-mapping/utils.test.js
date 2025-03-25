/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const createMapper = require('#agentlib/otel/attr-mapping/utils.js')
const test = require('node:test')
const assert = require('node:assert')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.span = {
    attributes: {
      key: 'value',
      legacyKey: 'legacyValue',
      anotherKey: 'test',
      onlyAttrs: 'attrs',
      malformed: true
    }
  }
  ctx.nr.fn = () => {}

  const mappings = {
    key: {
      attrs: ['key', 'legacyKey'],
      mapping() {
        return ctx.nr.fn
      }
    },
    anotherKey: {
      attrs({ span }) {
        return span
      }
    },
    onlyAttrs: {
      attrs: ['onlyAttrs']
    },
    noFunc: {
      mapping: true
    },
    malformed: {
      attrs: ['test'],
      mapping: () => false
    },
    onlyFunc: {
      mapping() {
        return ctx.nr.fn
      }
    }
  }
  const { getAttr, attributesMapper } = createMapper(mappings)
  ctx.nr.attrFn = getAttr
  ctx.nr.mapper = attributesMapper
})

test('should return value if span is passed into getAttr', (t) => {
  const { span, attrFn } = t.nr
  const value = attrFn({ key: 'key', span })
  assert.equal(value, 'value')
})

test('should not return value if attr is not found in attributes', (t) => {
  const { attrFn } = t.nr
  const span = {
    attributes: {
      test: 'value'
    }
  }
  const value = attrFn({ key: 'key', span })
  assert.equal(value, undefined)
})

test('should not return value if no span is present', (t) => {
  const { attrFn } = t.nr
  const value = attrFn({ key: 'test' })
  assert.equal(value, undefined)
})

test('should not return value if canonical key does not exist', (t) => {
  const { attrFn, span } = t.nr
  const value = attrFn({ key: 'bogus', span })
  assert.equal(value, undefined)
})

test('should return value if attrs is a function', (t) => {
  const { attrFn, span } = t.nr
  const value = attrFn({ key: 'anotherKey', span })
  assert.deepEqual(value, span)
})

test('should return mapping if fn is passed into abstractMapper with no span', (t) => {
  const { fn, mapper } = t.nr
  const mapping = mapper({ key: 'key' })
  assert.deepEqual(mapping, {
    key: fn,
    legacyKey: fn
  })
})

test('should return empty mapping and value when fn nor span are passed into abstractMapper', (t) => {
  const { mapper } = t.nr
  const mapping = mapper()
  assert.deepEqual(mapping, {})
})

test('should return empty mapping when a key does not exist on mapper', (t) => {
  const { mapper } = t.nr
  const mapping = mapper({ key: 'anotherKey' })
  assert.deepEqual(mapping, {})
})

test('should return empty mapping when the mapper is not a function', (t) => {
  const { mapper } = t.nr
  const mapping = mapper({ key: 'malformed' })
  assert.deepEqual(mapping, {})
})

test('should return empty mapping when the mapping is not a function', (t) => {
  const { mapper } = t.nr
  const mapping = mapper({ key: 'noFunc' })
  assert.deepEqual(mapping, {})
})

test('should return empty mapping when no attrs are present but there is a mapping function', (t) => {
  const { mapper } = t.nr
  const mapping = mapper({ key: 'onlyFunc' })
  assert.deepEqual(mapping, {})
})
