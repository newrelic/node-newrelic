'use strict'

const expect = require('chai').expect
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

describe('Event Aggregator', () => {
  let metrics = null
  let eventAggregator = null

  beforeEach(() => {
    metrics = new Metrics(5, {}, {})

    eventAggregator = new EventAggregator({
      runId: RUN_ID,
      limit: LIMIT,
      metricNames: METRIC_NAMES
    }, {}, metrics)
  })

  afterEach(() => {
    eventAggregator = null
  })

  describe('add()', () => {
    it('should add errors', () => {
      const rawEvent = [{type: 'some-event'}, {}, {}]
      eventAggregator.add(rawEvent)

      expect(eventAggregator.length).to.equal(1)

      const firstEvent = eventAggregator.events.toArray()[0]
      expect(rawEvent).to.equal(firstEvent)
    })

    it('should not add over limit', () => {
      eventAggregator.add([{type: 'some-event'}, {name: 'name1`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name2`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name3`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name4`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name5`'}, {}])

      expect(eventAggregator.length).to.equal(LIMIT)

      eventAggregator.add([{type: 'some-event'}, {name: 'name6`'}, {}])

      expect(eventAggregator.length).to.equal(LIMIT)
    })

    it('should increment seen metric for successful add', () => {
      const rawEvent = [{type: 'some-event'}, {}, {}]
      eventAggregator.add(rawEvent)

      expect(eventAggregator.length).to.equal(1)

      const metric = metrics.getMetric(METRIC_NAMES.SEEN)
      expect(metric.callCount).to.equal(1)
    })

    it('should increment seen metric for unsuccessful add', () => {
      eventAggregator.add([{type: 'some-event'}, {name: 'name1`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name2`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name3`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name4`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name5`'}, {}])

      eventAggregator.add([{type: 'some-event'}, {name: 'not added`'}, {}])

      expect(eventAggregator.length).to.equal(LIMIT)

      const metric = metrics.getMetric(METRIC_NAMES.SEEN)
      expect(metric.callCount).to.equal(LIMIT + 1)
    })

    it('should increment sent metric for successful add', () => {
      const rawEvent = [{type: 'some-event'}, {}, {}]
      eventAggregator.add(rawEvent)

      expect(eventAggregator.length).to.equal(1)

      const metric = metrics.getMetric(METRIC_NAMES.SENT)
      expect(metric.callCount).to.equal(1)
    })

    it('should not increment sent metric for unsuccessful add', () => {
      eventAggregator.add([{type: 'some-event'}, {name: 'name1`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name2`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name3`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name4`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name5`'}, {}])

      eventAggregator.add([{type: 'some-event'}, {name: 'not added`'}, {}])

      expect(eventAggregator.length).to.equal(LIMIT)

      const metric = metrics.getMetric(METRIC_NAMES.SENT)
      expect(metric.callCount).to.equal(LIMIT)
    })

    it('should increment dropped metric for unsucccesful add', () => {
      eventAggregator.add([{type: 'some-event'}, {name: 'name1`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name2`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name3`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name4`'}, {}])
      eventAggregator.add([{type: 'some-event'}, {name: 'name5`'}, {}])

      eventAggregator.add([{type: 'some-event'}, {name: 'not added`'}, {}])

      expect(eventAggregator.length).to.equal(LIMIT)

      const metric = metrics.getMetric(METRIC_NAMES.DROPPED)
      expect(metric.callCount).to.equal(1)
    })

    it('should not increment dropped metric for successful add', () =>{
      const rawEvent = [{type: 'some-event'}, {}, {}]
      eventAggregator.add(rawEvent)

      expect(eventAggregator.length).to.equal(1)

      const metric = metrics.getMetric(METRIC_NAMES.DROPPED)
      expect(metric).to.not.exist
    })
  })

  describe('_merge()', () => {
    it('should merge passed-in data with priorities', () => {
      const rawEvent = [{type: 'some-event'}, {name: 'name1'}, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(2)
      mergePriorityData.add([{type: 'some-event'}, {name: 'name2'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name3'}, {}])

      eventAggregator._merge(mergePriorityData)

      expect(eventAggregator.length).to.equal(3)
    })

    it('should not merge past limit', () => {
      const rawEvent = [{type: 'some-event'}, {name: 'name1'}, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(10)
      mergePriorityData.add([{type: 'some-event'}, {name: 'name2'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name3'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name4'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name5'}, {}])

      mergePriorityData.add([{type: 'some-event'}, {name: 'wont merge'}, {}])

      eventAggregator._merge(mergePriorityData)

      expect(eventAggregator.length).to.equal(LIMIT)
    })

    it('should increment seen metric for successful merge', () => {
      const rawEvent = [{type: 'some-event'}, {name: 'name1'}, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(2)
      mergePriorityData.add([{type: 'some-event'}, {name: 'name2'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name3'}, {}])

      eventAggregator._merge(mergePriorityData)

      expect(eventAggregator.length).to.equal(3)

      const metric = metrics.getMetric(METRIC_NAMES.SEEN)
      expect(metric.callCount).to.equal(3)
    })

    it('should increment seen metric for unsuccessful merge', () => {
      const rawEvent = [{type: 'some-event'}, {name: 'name1'}, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(10)
      mergePriorityData.add([{type: 'some-event'}, {name: 'name2'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name3'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name4'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name5'}, {}])

      mergePriorityData.add([{type: 'some-event'}, {name: 'wont merge'}, {}])

      eventAggregator._merge(mergePriorityData)

      expect(eventAggregator.length).to.equal(LIMIT)

      const metric = metrics.getMetric(METRIC_NAMES.SEEN)
      expect(metric.callCount).to.equal(LIMIT + 1)
    })

    it('should increment sent metric for successful merge', () => {
      const rawEvent = [{type: 'some-event'}, {name: 'name1'}, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(2)
      mergePriorityData.add([{type: 'some-event'}, {name: 'name2'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name3'}, {}])

      eventAggregator._merge(mergePriorityData)

      expect(eventAggregator.length).to.equal(3)

      const metric = metrics.getMetric(METRIC_NAMES.SENT)
      expect(metric.callCount).to.equal(3)
    })

    it('should not increment sent metric for unsuccessful merge', () => {
      const rawEvent = [{type: 'some-event'}, {name: 'name1'}, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(10)
      mergePriorityData.add([{type: 'some-event'}, {name: 'name2'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name3'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name4'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name5'}, {}])

      mergePriorityData.add([{type: 'some-event'}, {name: 'wont merge'}, {}])

      eventAggregator._merge(mergePriorityData)

      expect(eventAggregator.length).to.equal(LIMIT)

      const metric = metrics.getMetric(METRIC_NAMES.SENT)
      expect(metric.callCount).to.equal(LIMIT)
    })

    it('should increment dropped metric for unsucccesful merge', () => {
      const rawEvent = [{type: 'some-event'}, {name: 'name1'}, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(10)
      mergePriorityData.add([{type: 'some-event'}, {name: 'name2'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name3'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name4'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name5'}, {}])

      mergePriorityData.add([{type: 'some-event'}, {name: 'wont merge'}, {}])

      eventAggregator._merge(mergePriorityData)

      expect(eventAggregator.length).to.equal(LIMIT)

      const metric = metrics.getMetric(METRIC_NAMES.DROPPED)
      expect(metric.callCount).to.equal(1)
    })

    it('should not increment dropped metric for successful merge', () =>{
      const rawEvent = [{type: 'some-event'}, {name: 'name1'}, {}]
      eventAggregator.add(rawEvent)

      const mergePriorityData = new PriorityQueue(2)
      mergePriorityData.add([{type: 'some-event'}, {name: 'name2'}, {}])
      mergePriorityData.add([{type: 'some-event'}, {name: 'name3'}, {}])

      eventAggregator._merge(mergePriorityData)

      expect(eventAggregator.length).to.equal(3)

      const metric = metrics.getMetric(METRIC_NAMES.DROPPED)
      expect(metric).to.not.exist
    })
  })

  it('_getMergeData() should return events in priority collection', () => {
    const rawEvent = [{type: 'some-event'}, {}, {}]
    eventAggregator.add(rawEvent)

    const data = eventAggregator._getMergeData()
    expect(data.length).to.equal(1)

    expect(data.getMinimumPriority()).to.equal(0)
  })

  it('clear() should clear errors', () => {
    const rawEvent = [{type: 'some-event'}, {name: 'name1'}, {}]
    eventAggregator.add(rawEvent)

    expect(eventAggregator.length).to.equal(1)

    eventAggregator.clear()

    expect(eventAggregator.length).to.equal(0)
  })

  it('reconfigure() should update underlying container limits on resize', () => {
    const fakeConfig = {
      getAggregatorConfig: function() {
        return {
          periodMs: 3000,
          limit: LIMIT - 1
        }
      }
    }
    expect(eventAggregator._items.limit).to.equal(LIMIT)
    eventAggregator.reconfigure(fakeConfig)
    expect(eventAggregator._items.limit).to.equal(LIMIT - 1)
  })

  it('reconfigure() should not update underlying container on no resize', () => {
    const fakeConfig = {
      getAggregatorConfig: function() {
        return {
          periodMs: 3000,
          limit: LIMIT
        }
      }
    }

    expect(eventAggregator._items.limit).to.equal(LIMIT)
    eventAggregator.reconfigure(fakeConfig)
    expect(eventAggregator._items.limit).to.equal(LIMIT)
  })

  it('reconfigure() should update the period and limit when present', () => {
    const fakeConfig = {
      getAggregatorConfig: function() {
        return {
          periodMs: 3000,
          limit: 2000
        }
      }
    }

    expect(eventAggregator.periodMs).to.be.undefined
    expect(eventAggregator.limit).to.equal(LIMIT)

    eventAggregator.reconfigure(fakeConfig)

    expect(eventAggregator.periodMs).to.equal(3000)
    expect(eventAggregator.limit).to.equal(2000)
  })
})
