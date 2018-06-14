'use strict'

const expect = require('chai').expect
const helper = require('../../lib/agent_helper')
const SpanAggregator = require('../../../lib/spans/aggregator')

describe('SpanAggregator', () => {
  describe('#constructor()', () => {
    it('should set a default limit for aggregation', () => {
      const aggr = new SpanAggregator()
      expect(aggr).to.have.property('limit', 1000)
    })
  })

  describe('#addSegment()', () => {
    let aggr = null
    let agent = null

    beforeEach(() => {
      aggr = new SpanAggregator()
      agent = helper.instrumentMockedAgent()
    })
    afterEach(() => helper.unloadAgent(agent))

    it('should add a span event from the given segment', (done) => {
      helper.runInTransaction(agent, (tx) => {
        tx.priority = 42
        tx.sample = true

        setTimeout(() => {
          const segment = agent.tracer.getSegment()
          expect(aggr).to.have.length(0)
          aggr.addSegment(segment, 'p', 'g')
          expect(aggr).to.have.length(1)

          const event = aggr.getEvents()[0]

          expect(event).to.have.property('name', segment.name)
          expect(event).to.have.property('parentId', 'p')
          expect(event).to.have.property('grandparentId', 'g')

          done()
        }, 10)
      })
    })

    it('should default the parent and grandparent ids', (done) => {
      helper.runInTransaction(agent, (tx) => {
        tx.priority = 42
        tx.sample = true

        setTimeout(() => {
          const segment = agent.tracer.getSegment()
          expect(aggr).to.have.length(0)
          aggr.addSegment(segment)
          expect(aggr).to.have.length(1)

          const event = aggr.getEvents()[0]

          expect(event).to.have.property('name', segment.name)
          expect(event).to.have.property('parentId', null)
          expect(event).to.have.property('grandparentId', null)

          done()
        }, 10)
      })
    })

    it('should indicate if the segment is accepted', (done) => {
      aggr.limit = 1

      helper.runInTransaction(agent, (tx) => {
        tx.priority = 42
        tx.sample = true

        setTimeout(() => {
          const segment = agent.tracer.getSegment()

          expect(aggr).to.have.length(0)
          expect(aggr).to.have.property('seen', 0)

          // First segment is added regardless of priority.
          expect(aggr.addSegment(segment)).to.be.true
          expect(aggr).to.have.length(1)
          expect(aggr).to.have.property('seen', 1)

          // Higher priority should be added.
          tx.priority = 100
          expect(aggr.addSegment(segment)).to.be.true
          expect(aggr).to.have.length(1)
          expect(aggr).to.have.property('seen', 2)
          const event1 = aggr.getEvents()[0]

          // Lower priority should not be added.
          tx.priority = 1
          expect(aggr.addSegment(segment)).to.be.false
          expect(aggr).to.have.length(1)
          expect(aggr).to.have.property('seen', 3)
          const event2 = aggr.getEvents()[0]

          // Shouldn't change the event in the aggregator.
          expect(event1).to.equal(event2)

          done()
        }, 10)
      })
    })
  })
})
