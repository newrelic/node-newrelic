'use strict'

const expect = require('chai').expect
const EventAggregator = require('../../lib/event-aggregator')
const PriorityQueue = require('../../lib/priority-queue')

describe('EventAggregator', () => {
  describe('#constructor()', () => {
    it('should accept a limit', () => {
      const aggr = new EventAggregator(42)
      expect(aggr)
        .to.be.an.instanceOf(EventAggregator)
        .and.have.property('limit', 42)
    })
  })

  describe('#limit', () => {
    let aggr = null
    beforeEach(() => aggr = new EventAggregator(100))

    it('should return the current limit of the aggregator', () => {
      expect(aggr).to.have.property('limit', 100)
    })

    it('should be settable to new values', () => {
      expect(() => aggr.limit = 50).to.not.throw()
      expect(aggr).to.have.property('limit', 50)
    })

    it('should dispose of events when reduced below current size', () => {
      // Fill up the aggregator with events.
      for (let i = 0; i < aggr.limit; ++i) {
        aggr.addEvent({}, i)
      }
      expect(aggr).to.have.length(100)

      // Reduce the aggregator to 10.
      aggr.limit = 10
      expect(aggr).to.have.length(10)
      expect(aggr.getEvents()).to.have.length(10)

      // Increasing the size shouldn't affect the contents.
      aggr.limit = 1000
      expect(aggr).to.have.length(10)
      expect(aggr.getEvents()).to.have.length(10)
    })
  })

  describe('#seen', () => {
    let aggr = null
    beforeEach(() => aggr = new EventAggregator(5))

    it('should count the number of events attempted to add', () => {
      for (let i = 0; i < aggr.limit; ++i) {
        expect(aggr).to.have.property('seen', i)
        aggr.addEvent({}, i)
        expect(aggr).to.have.property('seen', i + 1)
      }
    })

    it('should include events that are discarded', () => {
      for (let i = 0; i < aggr.limit; ++i) {
        aggr.addEvent({}, i + 1)
      }
      expect(aggr).to.have.length(aggr.limit)

      // This event will not be added due to its low priority.
      aggr.addEvent({}, 0)
      expect(aggr).to.have.length(aggr.limit)
      expect(aggr).to.have.property('seen', aggr.limit + 1)

      // This event will be added and some other event discarded.
      aggr.addEvent({}, 1000)
      expect(aggr).to.have.length(aggr.limit)
      expect(aggr).to.have.property('seen', aggr.limit + 2)
    })
  })

  describe('#length', () => {
    let aggr = null
    beforeEach(() => aggr = new EventAggregator(5))

    it('should report the number of events currently in the aggregator', () => {
      for (let i = 0; i < aggr.limit; ++i) {
        expect(aggr).to.have.length(i)
        aggr.addEvent({}, i)
        expect(aggr).to.have.length(i + 1)
      }

      // This event will not be added due to its low priority.
      aggr.addEvent({}, 0)
      expect(aggr).to.have.length(aggr.limit)
    })
  })

  describe('#getEvents()', () => {
    let aggr = null
    beforeEach(() => aggr = new EventAggregator(5))

    it('should return an array containing the events added', () => {
      const events = new Set()
      for (let i = 0; i < aggr.limit; ++i) {
        const event = {}
        events.add(event)
        aggr.addEvent(event, i)
      }

      const aggrEvents = aggr.getEvents()
      expect(aggrEvents).to.have.length(aggr.length)

      // All the events returned should be what we put in.
      aggrEvents.forEach((event) => {
        expect(events.has(event)).to.be.true
        events.delete(event)
      })

      // Every event we put in should be returned.
      expect(events.size).to.equal(0)
    })
  })

  describe('#clearEvents()', () => {
    let aggr = null
    beforeEach(() => {
      aggr = new EventAggregator(5)
      for (let i = 0; i < aggr.limit; ++i) {
        aggr.addEvent({}, i + 1)
      }
    })

    it('should reset all counters', () => {
      expect(aggr).to.have.length(5)
      expect(aggr).to.have.property('seen', 5)
      expect(aggr).to.have.property('limit', 5)

      aggr.clearEvents()

      expect(aggr).to.have.length(0)
      expect(aggr).to.have.property('seen', 0)
      expect(aggr).to.have.property('limit', 5)
    })

    it('should remove aggregated events', () => {
      expect(aggr.getEvents()).to.have.length(5)

      aggr.clearEvents()

      expect(aggr.getEvents()).to.have.length(0)
    })

    it('should return the old priority queue', () => {
      const ret = aggr.clearEvents()
      expect(ret).to.be.an.instanceOf(PriorityQueue)
      expect(ret).to.have.length(5)
    })
  })

  describe('#addEvent()', () => {
    let aggr = null
    beforeEach(() => aggr = new EventAggregator(5))

    it('should add a new event to the aggregator', () => {
      expect(aggr.getEvents()).to.have.length(0)
      const event = {}

      aggr.addEvent(event, 1)

      expect(aggr.getEvents()).to.deep.equal([event])
    })

    describe('when aggregator is full', () => {
      beforeEach(() => {
        for (let i = 0; i < aggr.limit; ++i) {
          aggr.addEvent({priority: i + 1}, i + 1)
        }
      })

      it('should not add low priority events', () => {
        const event = {}

        expect(aggr).to.have.property('seen', aggr.limit)
        aggr.addEvent(event, 0)

        expect(aggr.getEvents()).to.not.contain(event)
        expect(aggr).to.have.property('seen', aggr.limit + 1)
      })

      it('should add high priority events and remove the lowest', () => {
        const event = {}
        const lowEvent = aggr.getEvents().find((e) => e.priority === 1)
        expect(lowEvent).to.exist

        aggr.addEvent(event, 100)

        const events = aggr.getEvents()
        expect(events)
          .to.contain(event)
          .and.not.contain(lowEvent)
      })
    })
  })

  describe('#mergeEvents()', () => {
    let oldEvents = null
    beforeEach(() => {
      const aggr = new EventAggregator(5)
      for (let i = 0; i < aggr.limit; ++i) {
        aggr.addEvent({priority: i}, i + 1)
      }
      oldEvents = aggr.clearEvents()
    })

    it('should copy the events from the given queue', () => {
      const aggr = new EventAggregator(5)
      const evntArray = oldEvents.toArray()
      aggr.mergeEvents(oldEvents)

      expect(aggr).to.have.length(5)
      expect(aggr.getEvents()).to.deep.equal(evntArray)
    })

    it('should obey priorities in both', () => {
      const aggr = new EventAggregator(3)
      const lowEvent = {priority: 0}
      const highEvent = {priority: 100}

      aggr.addEvent(lowEvent, 0)
      aggr.addEvent(highEvent, 100)

      aggr.mergeEvents(oldEvents)

      const events = aggr.getEvents()
      expect(events)
        .to.contain(highEvent)
        .and.not.contain(lowEvent)
    })

    it('should gracefully handle null events', () => {
      const aggr = new EventAggregator(5)
      expect(() => aggr.mergeEvents(null)).to.not.throw()
    })
  })
})
