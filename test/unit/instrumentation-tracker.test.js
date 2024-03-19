/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const InstrumentationTracker = require('../../lib/instrumentation-tracker')
const InstrumentationDescriptor = require('../../lib/instrumentation-descriptor')

tap.test('can inspect object type', async (t) => {
  const tracker = new InstrumentationTracker()
  t.equal(Object.prototype.toString.call(tracker), '[object InstrumentationTracker]')
})

tap.test('track method tracks new items and updates existing ones', async (t) => {
  const tracker = new InstrumentationTracker()
  const inst1 = new InstrumentationDescriptor({ moduleName: 'foo' })

  tracker.track('foo', inst1)
  t.equal(tracker.getAllByName('foo').length, 1)

  // Module already tracked and instrumentation id is the same.
  tracker.track('foo', inst1)
  t.equal(tracker.getAllByName('foo').length, 1)

  // Module already tracked, but new instrumentation with different id.
  const inst2 = new InstrumentationDescriptor({ moduleName: 'foo' })
  tracker.track('foo', inst2)
  t.equal(tracker.getAllByName('foo').length, 2)
})

tap.test('can get a tracked item by instrumentation', async (t) => {
  const tracker = new InstrumentationTracker()
  const inst = new InstrumentationDescriptor({ moduleName: 'foo' })

  tracker.track('foo', inst)
  const item = tracker.getTrackedItem('foo', inst)
  t.equal(item.instrumentation, inst)
  t.same(item.meta, { instrumented: false, didError: undefined })
})

tap.test('sets hook failure correctly', async (t) => {
  const tracker = new InstrumentationTracker()
  const inst = new InstrumentationDescriptor({ moduleName: 'foo' })

  tracker.track('foo', inst)
  const item = tracker.getTrackedItem('foo', inst)
  tracker.setHookFailure(item)
  t.equal(item.meta.instrumented, false)
  t.equal(item.meta.didError, true)

  // Double check that the item in the map got updated.
  const items = tracker.getAllByName('foo')
  t.equal(items[0].meta.instrumented, false)
  t.equal(items[0].meta.didError, true)
})

tap.test('sets hook success correctly', async (t) => {
  const tracker = new InstrumentationTracker()
  const inst = new InstrumentationDescriptor({ moduleName: 'foo' })

  tracker.track('foo', inst)
  const item = tracker.getTrackedItem('foo', inst)
  tracker.setHookSuccess(item)
  t.equal(item.meta.instrumented, true)
  t.equal(item.meta.didError, false)

  // Double check that the item in the map got updated.
  const items = tracker.getAllByName('foo')
  t.equal(items[0].meta.instrumented, true)
  t.equal(items[0].meta.didError, false)
})

tap.test('setResolvedName', (t) => {
  t.beforeEach((t) => {
    t.context.tracker = new InstrumentationTracker()
  })

  t.test('throws expected error', async (t) => {
    const { tracker } = t.context
    t.throws(() => tracker.setResolvedName('foo', 'bar'), 'module not tracked: foo')
  })

  t.test('skips existing tracked items', async (t) => {
    const { tracker } = t.context
    const inst = new InstrumentationDescriptor({
      moduleName: 'foo',
      resolvedName: '/opt/app/node_modules/foo'
    })

    tracker.track('foo', inst)
    tracker.setResolvedName('foo', '/opt/app/node_modules/foo')
    t.equal(tracker.getAllByName('foo').length, 1)
  })

  t.test('adds new tracked item for new resolved name', async (t) => {
    const { tracker } = t.context
    const inst1 = new InstrumentationDescriptor({
      moduleName: 'foo',
      resolvedName: '/opt/app/node_modules/foo'
    })

    tracker.track('foo', inst1)
    tracker.setResolvedName('foo', '/opt/app/node_modules/transitive-dep/node_modules/foo')

    const items = tracker.getAllByName('foo')
    t.equal(items[0].instrumentation.resolvedName, '/opt/app/node_modules/foo')
    t.equal(
      items[1].instrumentation.resolvedName,
      '/opt/app/node_modules/transitive-dep/node_modules/foo'
    )
  })

  t.test('updates all registered instrumentations with resolve name', async (t) => {
    const { tracker } = t.context
    const inst1 = new InstrumentationDescriptor({ moduleName: 'foo' })
    const inst2 = new InstrumentationDescriptor({ moduleName: 'foo' })

    tracker.track('foo', inst1)
    tracker.track('foo', inst2)
    tracker.setResolvedName('foo', '/opt/app/node_modules/foo')

    const items = tracker.getAllByName('foo')
    t.equal(items[0].instrumentation.resolvedName, '/opt/app/node_modules/foo')
    t.equal(items[1].instrumentation.resolvedName, '/opt/app/node_modules/foo')
  })

  t.end()
})
