'use strict'

const expect = require('chai').expect
const helper = require('../../lib/agent_helper')
const SpanEventAggregator = require('../../../lib/spans/span-event-aggregator')
const Metrics = require('../../../lib/metrics')

const RUN_ID = 1337
const LIMIT = 1000

describe('SpanAggregator', () => {
  let spanEventAggregator = null
  let agent = null

  beforeEach(() => {
    spanEventAggregator = new SpanEventAggregator({
      runId: RUN_ID,
      limit: LIMIT
    }, {}, new Metrics(5, {}, {}))
    agent = helper.instrumentMockedAgent()
  })

  afterEach(() => {
    spanEventAggregator = null
    helper.unloadAgent(agent)
  })

  it('should add a span event from the given segment', (done) => {
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sample = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()
        expect(spanEventAggregator).to.have.length(0)
        spanEventAggregator.addSegment(segment, 'p')
        expect(spanEventAggregator).to.have.length(1)

        const event = spanEventAggregator.getEvents()[0]

        expect(event).to.have.property('intrinsics')
        expect(event.intrinsics).to.have.property('name', segment.name)
        expect(event.intrinsics).to.have.property('parentId', 'p')

        done()
      }, 10)
    })    
  })

  it('should default the parent id', (done) => {
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sample = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()
        expect(spanEventAggregator).to.have.length(0)
        spanEventAggregator.addSegment(segment)
        expect(spanEventAggregator).to.have.length(1)

        const event = spanEventAggregator.getEvents()[0]

        expect(event).to.have.property('intrinsics')
        expect(event.intrinsics).to.have.property('name', segment.name)
        expect(event.intrinsics).to.have.property('parentId', null)
        expect(event.intrinsics).to.not.have.property('grandparentId')

        done()
      }, 10)
    })
  })
  
  it('should indicate if the segment is accepted', (done) => {
    spanEventAggregator = new SpanEventAggregator({
      runId: RUN_ID,
      limit: 1
    }, {}, new Metrics(5, {}, {}))

    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sample = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()

        expect(spanEventAggregator).to.have.length(0)
        expect(spanEventAggregator).to.have.property('seen', 0)

        // First segment is added regardless of priority.
        expect(spanEventAggregator.addSegment(segment)).to.be.true
        expect(spanEventAggregator).to.have.length(1)
        expect(spanEventAggregator).to.have.property('seen', 1)

        // Higher priority should be added.
        tx.priority = 100
        expect(spanEventAggregator.addSegment(segment)).to.be.true
        expect(spanEventAggregator).to.have.length(1)
        expect(spanEventAggregator).to.have.property('seen', 2)
        const event1 = spanEventAggregator.getEvents()[0]

        // Lower priority should not be added.
        tx.priority = 1
        expect(spanEventAggregator.addSegment(segment)).to.be.false
        expect(spanEventAggregator).to.have.length(1)
        expect(spanEventAggregator).to.have.property('seen', 3)
        const event2 = spanEventAggregator.getEvents()[0]

        // Shouldn't change the event in the aggregator.
        expect(event1).to.equal(event2)

        done()
      }, 10)
    })
  })  
})
