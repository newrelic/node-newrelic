/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const EventAggregator = require('../../../lib/aggregators/event-aggregator')
const PriorityQueue = require('../../../lib/priority-queue')
const Metrics = require('../../../lib/metrics')

const RUN_ID = 1337
const LIMIT = 5

const METRIC_NAMES = {
  SEEN: '/SEEN',
  SENT: '/SENT',
  DROPPED: '/DROPPED'
}

test.beforeEach((ctx) => {
  ctx.nr = {}

  ctx.nr.metrics = new Metrics(5, {}, {})
  ctx.nr.harvester = { add() {} }

  ctx.nr.eventAggregator = new EventAggregator(
    {
      runId: RUN_ID,
      limit: LIMIT,
      metricNames: METRIC_NAMES
    },
    {
      collector: {},
      metrics: ctx.nr.metrics,
      harvester: ctx.nr.harvester
    }
  )
})

test('add()', async (t) => {
  await t.test('should add errors', (t) => {
    const { eventAggregator } = t.nr
    const rawEvent = [{ type: 'some-event' }, {}, {}]

    eventAggregator.add(rawEvent)
    assert.equal(eventAggregator.length, 1)

    const firstEvent = eventAggregator.events.toArray()[0]
    assert.equal(firstEvent, rawEvent)
  })

  await t.test('should not add over limit', (t) => {
    const { eventAggregator } = t.nr

    eventAggregator.add([{ type: 'some-event' }, { name: 'name1`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name2`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name3`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name4`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name5`' }, {}])
    assert.equal(eventAggregator.length, LIMIT)

    eventAggregator.add([{ type: 'some-event' }, { name: 'name6`' }, {}])
    assert.equal(eventAggregator.length, LIMIT)
  })

  await t.test('should increment seen metric for successful add', (t) => {
    const { eventAggregator, metrics } = t.nr
    const rawEvent = [{ type: 'some-event' }, {}, {}]

    eventAggregator.add(rawEvent)
    assert.equal(eventAggregator.length, 1)

    const metric = metrics.getMetric(METRIC_NAMES.SEEN)
    assert.equal(metric.callCount, 1)
  })

  await t.test('should increment seen metric for unsuccessful add', (t) => {
    const { eventAggregator, metrics } = t.nr

    eventAggregator.add([{ type: 'some-event' }, { name: 'name1`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name2`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name3`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name4`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name5`' }, {}])

    eventAggregator.add([{ type: 'some-event' }, { name: 'not added`' }, {}])

    assert.equal(eventAggregator.length, LIMIT)

    const metric = metrics.getMetric(METRIC_NAMES.SEEN)
    assert.equal(metric.callCount, LIMIT + 1)
  })

  await t.test('should increment sent metric for successful add', (t) => {
    const { eventAggregator, metrics } = t.nr
    const rawEvent = [{ type: 'some-event' }, {}, {}]

    eventAggregator.add(rawEvent)
    assert.equal(eventAggregator.length, 1)

    const metric = metrics.getMetric(METRIC_NAMES.SENT)
    assert.equal(metric.callCount, 1)
  })

  await t.test('should not increment sent metric for unsuccessful add', (t) => {
    const { eventAggregator, metrics } = t.nr

    eventAggregator.add([{ type: 'some-event' }, { name: 'name1`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name2`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name3`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name4`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name5`' }, {}])

    eventAggregator.add([{ type: 'some-event' }, { name: 'not added`' }, {}])

    assert.equal(eventAggregator.length, LIMIT)

    const metric = metrics.getMetric(METRIC_NAMES.SENT)
    assert.equal(metric.callCount, LIMIT)
  })

  await t.test('should increment dropped metric for unsuccessful add', (t) => {
    const { eventAggregator, metrics } = t.nr

    eventAggregator.add([{ type: 'some-event' }, { name: 'name1`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name2`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name3`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name4`' }, {}])
    eventAggregator.add([{ type: 'some-event' }, { name: 'name5`' }, {}])

    eventAggregator.add([{ type: 'some-event' }, { name: 'not added`' }, {}])

    assert.equal(eventAggregator.length, LIMIT)

    const metric = metrics.getMetric(METRIC_NAMES.DROPPED)
    assert.equal(metric.callCount, 1)
  })

  await t.test('should not increment dropped metric for successful add', (t) => {
    const { eventAggregator, metrics } = t.nr
    const rawEvent = [{ type: 'some-event' }, {}, {}]

    eventAggregator.add(rawEvent)
    assert.equal(eventAggregator.length, 1)

    const metric = metrics.getMetric(METRIC_NAMES.DROPPED)
    assert.equal(metric, undefined)
  })
})

test('_merge()', async (t) => {
  await t.test('should merge passed-in data with priorities', (t) => {
    const { eventAggregator } = t.nr
    const mergePriorityData = new PriorityQueue(2)
    const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]

    eventAggregator.add(rawEvent)
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])
    eventAggregator._merge(mergePriorityData)

    assert.equal(eventAggregator.length, 3)
  })

  await t.test('should not merge past limit', (t) => {
    const { eventAggregator } = t.nr
    const mergePriorityData = new PriorityQueue(10)
    const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]

    eventAggregator.add(rawEvent)
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name4' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name5' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'wont merge' }, {}])
    eventAggregator._merge(mergePriorityData)

    assert.equal(eventAggregator.length, LIMIT)
  })

  await t.test('should increment seen metric for successful merge', (t) => {
    const { eventAggregator, metrics } = t.nr
    const mergePriorityData = new PriorityQueue(2)
    const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]

    eventAggregator.add(rawEvent)
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])
    eventAggregator._merge(mergePriorityData)

    assert.equal(eventAggregator.length, 3)

    const metric = metrics.getMetric(METRIC_NAMES.SEEN)
    assert.equal(metric.callCount, 3)
  })

  await t.test('should increment seen metric for unsuccessful merge', (t) => {
    const { eventAggregator, metrics } = t.nr
    const mergePriorityData = new PriorityQueue(10)
    const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]

    eventAggregator.add(rawEvent)
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name4' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name5' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'wont merge' }, {}])
    eventAggregator._merge(mergePriorityData)

    assert.equal(eventAggregator.length, LIMIT)

    const metric = metrics.getMetric(METRIC_NAMES.SEEN)
    assert.equal(metric.callCount, LIMIT + 1)
  })

  await t.test('should increment sent metric for successful merge', (t) => {
    const { eventAggregator, metrics } = t.nr
    const mergePriorityData = new PriorityQueue(2)
    const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]

    eventAggregator.add(rawEvent)
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])
    eventAggregator._merge(mergePriorityData)

    assert.equal(eventAggregator.length, 3)

    const metric = metrics.getMetric(METRIC_NAMES.SENT)
    assert.equal(metric.callCount, 3)
  })

  await t.test('should increment sent metric for unsuccessful merge', (t) => {
    const { eventAggregator, metrics } = t.nr
    const mergePriorityData = new PriorityQueue(10)
    const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]

    eventAggregator.add(rawEvent)
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name4' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name5' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'wont merge' }, {}])
    eventAggregator._merge(mergePriorityData)

    assert.equal(eventAggregator.length, LIMIT)

    const metric = metrics.getMetric(METRIC_NAMES.SENT)
    assert.equal(metric.callCount, LIMIT)
  })

  await t.test('should increment dropped metric for unsuccessful merge', (t) => {
    const { eventAggregator, metrics } = t.nr
    const mergePriorityData = new PriorityQueue(10)
    const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]

    eventAggregator.add(rawEvent)
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name4' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name5' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'wont merge' }, {}])
    eventAggregator._merge(mergePriorityData)

    assert.equal(eventAggregator.length, LIMIT)

    const metric = metrics.getMetric(METRIC_NAMES.DROPPED)
    assert.equal(metric.callCount, 1)
  })

  await t.test('should not increment dropped metric for successful merge', (t) => {
    const { eventAggregator, metrics } = t.nr
    const mergePriorityData = new PriorityQueue(2)
    const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]

    eventAggregator.add(rawEvent)
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
    mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])
    eventAggregator._merge(mergePriorityData)

    assert.equal(eventAggregator.length, 3)

    const metric = metrics.getMetric(METRIC_NAMES.DROPPED)
    assert.equal(metric, undefined)
  })
})

test('_getMergeData()', async (t) => {
  await t.test('should return events in priority collection', (t) => {
    const { eventAggregator } = t.nr
    const rawEvent = [{ type: 'some-event' }, {}, {}]

    eventAggregator.add(rawEvent)
    const data = eventAggregator._getMergeData()
    assert.equal(data.length, 1)
    assert.equal(data.getMinimumPriority(), 0)
  })
})

test('clear()', async (t) => {
  await t.test('should clear errors', (t) => {
    const { eventAggregator } = t.nr
    const rawEvent = [{ type: 'some-event' }, {}, {}]

    eventAggregator.add(rawEvent)
    assert.equal(eventAggregator.length, 1)
    eventAggregator.clear()
    assert.equal(eventAggregator.length, 0)
  })
})

test('reconfigure()', async (t) => {
  await t.test('should update underlying container limits on resize', (t) => {
    const { eventAggregator } = t.nr
    const fakeConfig = {
      getAggregatorConfig() {
        return { periodMs: 3000, limit: LIMIT - 1 }
      }
    }

    assert.equal(eventAggregator._items.limit, LIMIT)
    eventAggregator.reconfigure(fakeConfig)
    assert.equal(eventAggregator._items.limit, LIMIT - 1)
  })

  await t.test('should not update underlying container limits on no resize', (t) => {
    const { eventAggregator } = t.nr
    const fakeConfig = {
      getAggregatorConfig() {
        return { periodMs: 3000, limit: LIMIT }
      }
    }

    assert.equal(eventAggregator._items.limit, LIMIT)
    eventAggregator.reconfigure(fakeConfig)
    assert.equal(eventAggregator._items.limit, LIMIT)
  })

  await t.test('should update the period and limit when present', (t) => {
    const { eventAggregator } = t.nr
    const fakeConfig = {
      getAggregatorConfig() {
        return { periodMs: 3000, limit: 2000 }
      }
    }

    assert.equal(eventAggregator.periodMs, undefined)
    assert.equal(eventAggregator.limit, LIMIT)
    eventAggregator.reconfigure(fakeConfig)
    assert.equal(eventAggregator.periodMs, 3000)
    assert.equal(eventAggregator.limit, 2000)
  })
})
