/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const InstrumentationTracker = require('../../lib/instrumentation-tracker')
const InstrumentationDescriptor = require('../../lib/instrumentation-descriptor')

test('can inspect object type', async () => {
  const tracker = new InstrumentationTracker()
  assert.equal(Object.prototype.toString.call(tracker), '[object InstrumentationTracker]')
})

test('track method tracks new items and updates existing ones', async () => {
  const tracker = new InstrumentationTracker()
  const inst1 = new InstrumentationDescriptor({ moduleName: 'foo' })

  tracker.track('foo', inst1)
  assert.equal(tracker.getAllByName('foo').length, 1)

  // Module already tracked and instrumentation id is the same.
  tracker.track('foo', inst1)
  assert.equal(tracker.getAllByName('foo').length, 1)

  // Module already tracked, but new instrumentation with different id.
  const inst2 = new InstrumentationDescriptor({ moduleName: 'foo' })
  tracker.track('foo', inst2)
  assert.equal(tracker.getAllByName('foo').length, 2)
})

test('can get a tracked item by instrumentation', async () => {
  const tracker = new InstrumentationTracker()
  const inst = new InstrumentationDescriptor({ moduleName: 'foo' })

  tracker.track('foo', inst)
  const item = tracker.getTrackedItem('foo', inst)
  assert.equal(item.instrumentation, inst)
  assert.deepEqual(item.meta, { instrumented: false, didError: undefined })
})

test('sets hook failure correctly', async () => {
  const tracker = new InstrumentationTracker()
  const inst = new InstrumentationDescriptor({ moduleName: 'foo' })

  tracker.track('foo', inst)
  const item = tracker.getTrackedItem('foo', inst)
  tracker.setHookFailure(item)
  assert.equal(item.meta.instrumented, false)
  assert.equal(item.meta.didError, true)

  // Double check that the item in the map got updated.
  const items = tracker.getAllByName('foo')
  assert.equal(items[0].meta.instrumented, false)
  assert.equal(items[0].meta.didError, true)
})

test('sets hook success correctly', async () => {
  const tracker = new InstrumentationTracker()
  const inst = new InstrumentationDescriptor({ moduleName: 'foo' })

  tracker.track('foo', inst)
  const item = tracker.getTrackedItem('foo', inst)
  tracker.setHookSuccess(item)
  assert.equal(item.meta.instrumented, true)
  assert.equal(item.meta.didError, false)

  // Double check that the item in the map got updated.
  const items = tracker.getAllByName('foo')
  assert.equal(items[0].meta.instrumented, true)
  assert.equal(items[0].meta.didError, false)
})

test('setResolvedName', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.tracker = new InstrumentationTracker()
  })

  await t.test('throws expected error', (t) => {
    const { tracker } = t.nr
    assert.throws(() => tracker.setResolvedName('foo', 'bar'), Error('module not tracked: foo'))
  })

  await t.test('skips existing tracked items', (t) => {
    const { tracker } = t.nr
    const inst = new InstrumentationDescriptor({
      moduleName: 'foo',
      resolvedName: '/opt/app/node_modules/foo'
    })

    tracker.track('foo', inst)
    tracker.setResolvedName('foo', '/opt/app/node_modules/foo')
    assert.equal(tracker.getAllByName('foo').length, 1)
  })

  await t.test('adds new tracked item for new resolved name', (t) => {
    const { tracker } = t.nr
    const inst1 = new InstrumentationDescriptor({
      moduleName: 'foo',
      resolvedName: '/opt/app/node_modules/foo'
    })

    tracker.track('foo', inst1)
    tracker.setResolvedName('foo', '/opt/app/node_modules/transitive-dep/node_modules/foo')

    const items = tracker.getAllByName('foo')
    assert.equal(items[0].instrumentation.resolvedName, '/opt/app/node_modules/foo')
    assert.equal(
      items[1].instrumentation.resolvedName,
      '/opt/app/node_modules/transitive-dep/node_modules/foo'
    )
  })

  await t.test('updates all registered instrumentations with resolve name', (t) => {
    const { tracker } = t.nr
    const inst1 = new InstrumentationDescriptor({ moduleName: 'foo' })
    const inst2 = new InstrumentationDescriptor({ moduleName: 'foo' })

    tracker.track('foo', inst1)
    tracker.track('foo', inst2)
    tracker.setResolvedName('foo', '/opt/app/node_modules/foo')

    const items = tracker.getAllByName('foo')
    assert.equal(items[0].instrumentation.resolvedName, '/opt/app/node_modules/foo')
    assert.equal(items[1].instrumentation.resolvedName, '/opt/app/node_modules/foo')
  })
})
