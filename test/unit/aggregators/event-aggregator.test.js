/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
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

tap.test('Event Aggregator', (t) => {
  t.autoend()

  let metrics = null
  let eventAggregator = null

  function beforeTest() {
    metrics = new Metrics(5, {}, {})

    eventAggregator = new EventAggregator(
      {
        runId: RUN_ID,
        limit: LIMIT,
        metricNames: METRIC_NAMES
      },
      {},
      metrics
    )
  }

  function afterTest() {
    eventAggregator = null
  }

  t.test('add()', (t) => {
    t.autoend()

    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should add errors', (t) => {
      const rawEvent = [{ type: 'some-event' }, {}, {}]
      eventAggregator.add(rawEvent)

      t.equal(eventAggregator.length, 1)

      const firstEvent = eventAggregator.events.toArray()[0]
      t.equal(rawEvent, firstEvent)

      t.end()
    })

    t.test('should not add over limit', (t) => {
      eventAggregator.add([{ type: 'some-event' }, { name: 'name1`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name2`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name3`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name4`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name5`' }, {}])

      t.equal(eventAggregator.length, LIMIT)

      eventAggregator.add([{ type: 'some-event' }, { name: 'name6`' }, {}])

      t.equal(eventAggregator.length, LIMIT)

      t.end()
    })

    t.test('should increment seen metric for successful add', (t) => {
      const rawEvent = [{ type: 'some-event' }, {}, {}]
      eventAggregator.add(rawEvent)

      t.equal(eventAggregator.length, 1)

      const metric = metrics.getMetric(METRIC_NAMES.SEEN)
      t.equal(metric.callCount, 1)

      t.end()
    })

    t.test('should increment seen metric for unsuccessful add', (t) => {
      eventAggregator.add([{ type: 'some-event' }, { name: 'name1`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name2`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name3`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name4`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name5`' }, {}])

      eventAggregator.add([{ type: 'some-event' }, { name: 'not added`' }, {}])

      t.equal(eventAggregator.length, LIMIT)

      const metric = metrics.getMetric(METRIC_NAMES.SEEN)
      t.equal(metric.callCount, LIMIT + 1)

      t.end()
    })

    t.test('should increment sent metric for successful add', (t) => {
      const rawEvent = [{ type: 'some-event' }, {}, {}]
      eventAggregator.add(rawEvent)

      t.equal(eventAggregator.length, 1)

      const metric = metrics.getMetric(METRIC_NAMES.SENT)
      t.equal(metric.callCount, 1)

      t.end()
    })

    t.test('should not increment sent metric for unsuccessful add', (t) => {
      eventAggregator.add([{ type: 'some-event' }, { name: 'name1`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name2`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name3`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name4`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name5`' }, {}])

      eventAggregator.add([{ type: 'some-event' }, { name: 'not added`' }, {}])

      t.equal(eventAggregator.length, LIMIT)

      const metric = metrics.getMetric(METRIC_NAMES.SENT)
      t.equal(metric.callCount, LIMIT)

      t.end()
    })

    t.test('should increment dropped metric for unsucccesful add', (t) => {
      eventAggregator.add([{ type: 'some-event' }, { name: 'name1`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name2`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name3`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name4`' }, {}])
      eventAggregator.add([{ type: 'some-event' }, { name: 'name5`' }, {}])

      eventAggregator.add([{ type: 'some-event' }, { name: 'not added`' }, {}])

      t.equal(eventAggregator.length, LIMIT)

      const metric = metrics.getMetric(METRIC_NAMES.DROPPED)
      t.equal(metric.callCount, 1)

      t.end()
    })

    t.test('should not increment dropped metric for successful add', (t) => {
      const rawEvent = [{ type: 'some-event' }, {}, {}]
      eventAggregator.add(rawEvent)

      t.equal(eventAggregator.length, 1)

      const metric = metrics.getMetric(METRIC_NAMES.DROPPED)
      t.notOk(metric)

      t.end()
    })
  })

  t.test('_merge()', (t) => {
    t.autoend()

    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should merge passed-in data with priorities', (t) => {
      const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(2)
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])

      eventAggregator._merge(mergePriorityData)

      t.equal(eventAggregator.length, 3)

      t.end()
    })

    t.test('should not merge past limit', (t) => {
      const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(10)
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name4' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name5' }, {}])

      mergePriorityData.add([{ type: 'some-event' }, { name: 'wont merge' }, {}])

      eventAggregator._merge(mergePriorityData)

      t.equal(eventAggregator.length, LIMIT)

      t.end()
    })

    t.test('should increment seen metric for successful merge', (t) => {
      const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(2)
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])

      eventAggregator._merge(mergePriorityData)

      t.equal(eventAggregator.length, 3)

      const metric = metrics.getMetric(METRIC_NAMES.SEEN)
      t.equal(metric.callCount, 3)

      t.end()
    })

    t.test('should increment seen metric for unsuccessful merge', (t) => {
      const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(10)
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name4' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name5' }, {}])

      mergePriorityData.add([{ type: 'some-event' }, { name: 'wont merge' }, {}])

      eventAggregator._merge(mergePriorityData)

      t.equal(eventAggregator.length, LIMIT)

      const metric = metrics.getMetric(METRIC_NAMES.SEEN)
      t.equal(metric.callCount, LIMIT + 1)

      t.end()
    })

    t.test('should increment sent metric for successful merge', (t) => {
      const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(2)
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])

      eventAggregator._merge(mergePriorityData)

      t.equal(eventAggregator.length, 3)

      const metric = metrics.getMetric(METRIC_NAMES.SENT)
      t.equal(metric.callCount, 3)

      t.end()
    })

    t.test('should not increment sent metric for unsuccessful merge', (t) => {
      const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(10)
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name4' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name5' }, {}])

      mergePriorityData.add([{ type: 'some-event' }, { name: 'wont merge' }, {}])

      eventAggregator._merge(mergePriorityData)

      t.equal(eventAggregator.length, LIMIT)

      const metric = metrics.getMetric(METRIC_NAMES.SENT)
      t.equal(metric.callCount, LIMIT)

      t.end()
    })

    t.test('should increment dropped metric for unsucccesful merge', (t) => {
      const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(10)
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name4' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name5' }, {}])

      mergePriorityData.add([{ type: 'some-event' }, { name: 'wont merge' }, {}])

      eventAggregator._merge(mergePriorityData)

      t.equal(eventAggregator.length, LIMIT)

      const metric = metrics.getMetric(METRIC_NAMES.DROPPED)
      t.equal(metric.callCount, 1)

      t.end()
    })

    t.test('should not increment dropped metric for successful merge', (t) => {
      const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(2)
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name2' }, {}])
      mergePriorityData.add([{ type: 'some-event' }, { name: 'name3' }, {}])

      eventAggregator._merge(mergePriorityData)

      t.equal(eventAggregator.length, 3)

      const metric = metrics.getMetric(METRIC_NAMES.DROPPED)
      t.notOk(metric)

      t.end()
    })
  })

  t.test('_getMergeData()', (t) => {
    t.autoend()

    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should return events in priority collection', (t) => {
      const rawEvent = [{ type: 'some-event' }, {}, {}]
      eventAggregator.add(rawEvent)

      const data = eventAggregator._getMergeData()
      t.equal(data.length, 1)

      t.equal(data.getMinimumPriority(), 0)

      t.end()
    })
  })

  t.test('clear()', (t) => {
    t.autoend()

    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should clear errors', (t) => {
      const rawEvent = [{ type: 'some-event' }, { name: 'name1' }, {}]
      eventAggregator.add(rawEvent)

      t.equal(eventAggregator.length, 1)

      eventAggregator.clear()

      t.equal(eventAggregator.length, 0)

      t.end()
    })
  })

  t.test('reconfigure()', (t) => {
    t.autoend()

    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should update underlying container limits on resize', (t) => {
      const fakeConfig = {
        getAggregatorConfig: function () {
          return {
            periodMs: 3000,
            limit: LIMIT - 1
          }
        }
      }
      t.equal(eventAggregator._items.limit, LIMIT)
      eventAggregator.reconfigure(fakeConfig)
      t.equal(eventAggregator._items.limit, LIMIT - 1)

      t.end()
    })

    t.test('reconfigure() should not update underlying container on no resize', (t) => {
      const fakeConfig = {
        getAggregatorConfig: function () {
          return {
            periodMs: 3000,
            limit: LIMIT
          }
        }
      }

      t.equal(eventAggregator._items.limit, LIMIT)
      eventAggregator.reconfigure(fakeConfig)
      t.equal(eventAggregator._items.limit, LIMIT)

      t.end()
    })

    t.test('reconfigure() should update the period and limit when present', (t) => {
      const fakeConfig = {
        getAggregatorConfig: function () {
          return {
            periodMs: 3000,
            limit: 2000
          }
        }
      }

      t.equal(eventAggregator.periodMs, undefined)
      t.equal(eventAggregator.limit, LIMIT)

      eventAggregator.reconfigure(fakeConfig)

      t.equal(eventAggregator.periodMs, 3000)
      t.equal(eventAggregator.limit, 2000)

      t.end()
    })
  })
})
