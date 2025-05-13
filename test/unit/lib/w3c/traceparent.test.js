/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const Traceparent = require('#agentlib/w3c/traceparent.js')

test('instances from header values', async t => {
  await t.test('rejects non-string values', () => {
    const expected = /header value must be a string/
    assert.throws(() => Traceparent.fromHeader(Buffer.from('')), expected)
    assert.throws(() => Traceparent.fromHeader(42), expected)
  })

  await t.test('requires correct number of fields', () => {
    const expected = /traceparent header should have 4 parts/
    assert.throws(() => Traceparent.fromHeader('1'), expected)
    assert.throws(() => Traceparent.fromHeader('1-2'), expected)
    assert.throws(() => Traceparent.fromHeader('1-2-3'), expected)
    assert.throws(() => Traceparent.fromHeader('1-2-3-4-5'), expected)
  })

  await t.test('requires the correct version', () => {
    const expected = /only w3c version 00 is supported/
    assert.throws(() => Traceparent.fromHeader('01-2-3-4'), expected)
    assert.throws(() => Traceparent.fromHeader('ff-2-3-4'), expected)
  })

  await t.test('requires a valid trace id', () => {
    const expected = /received invalid trace id/
    let id = '0'.repeat(32)
    assert.throws(() => Traceparent.fromHeader(`00-${id}-3-4`), expected)

    id = 'A' + id.slice(1)
    assert.throws(() => Traceparent.fromHeader(`00-${id}-3-4`), expected)

    id = 'Z' + id.slice(1)
    assert.throws(() => Traceparent.fromHeader(`00-${id}-3-4`), expected)

    id = 'ab34cd'
    assert.throws(() => Traceparent.fromHeader(`00-${id}-3-4`), expected)
  })

  await t.test('requires valid parent id', () => {
    const expected = /received invalid parent id/
    const trace = 'ab'.repeat(16)
    let id = '0'.repeat(16)
    assert.throws(() => Traceparent.fromHeader(`00-${trace}-${id}-00`), expected)

    id = 'A' + id.slice(1)
    assert.throws(() => Traceparent.fromHeader(`00-${trace}-${id}-00`), expected)

    id = 'Z' + id.slice(1)
    assert.throws(() => Traceparent.fromHeader(`00-${trace}-${id}-00`), expected)
  })

  await t.test('requires valid flags', () => {
    const expected = /received invalid flags/
    const base = '00-ab12cd34ef56ab12cd34ef56ab12cd34-1234567890abcdef-'
    assert.throws(() => Traceparent.fromHeader(`${base}AB`), expected)
    assert.throws(() => Traceparent.fromHeader(`${base}gg`), expected)
  })

  await t.test('isSampled returns correct values', () => {
    const base = '00-ab12cd34ef56ab12cd34ef56ab12cd34-1234567890abcdef-'

    let traceparent = Traceparent.fromHeader(`${base}00`)
    assert.equal(traceparent.isSampled, false)

    traceparent = Traceparent.fromHeader(`${base}01`)
    assert.equal(traceparent.isSampled, true)
  })
})
