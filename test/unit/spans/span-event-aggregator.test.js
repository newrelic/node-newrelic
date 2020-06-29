/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const expect = require('chai').expect
const helper = require('../../lib/agent_helper')
const SpanEventAggregator = require('../../../lib/spans/span-event-aggregator')
const Metrics = require('../../../lib/metrics')
const sinon = require('sinon')
const logger = require('../../../lib/logger')

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
    agent = helper.instrumentMockedAgent({
      distributed_tracing: {
        enabled: true
      }
    })
  })

  afterEach(() => {
    spanEventAggregator = null
    helper.unloadAgent(agent)
  })

  it('should set the correct default method', () => {
    const method = spanEventAggregator.method

    expect(method).to.equal('span_event_data')
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
    const METRIC_NAMES = {
      SEEN: '/SEEN',
      SENT: '/SENT',
      DROPPED: '/DROPPED'
    }

    const metrics = new Metrics(5, {}, {})

    spanEventAggregator = new SpanEventAggregator({
      runId: RUN_ID,
      limit: 1,
      metricNames: METRIC_NAMES
    }, {}, metrics)

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

        const metric = metrics.getMetric(METRIC_NAMES.SEEN)

        expect(metric.callCount).to.equal(3)

        // Shouldn't change the event in the aggregator.
        expect(event1).to.equal(event2)

        done()
      }, 10)
    })
  })

  it('_toPayloadSync() should return json format of data', (done) => {
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 1
      tx.sample = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()

        spanEventAggregator.addSegment(segment)

        var payload = spanEventAggregator._toPayloadSync()

        const [runId, metrics, events] = payload

        expect(runId).to.equal(RUN_ID)

        expect(metrics).to.have.property('reservoir_size')
        expect(metrics).to.have.property('events_seen')
        expect(metrics.reservoir_size).to.equal(LIMIT)
        expect(metrics.events_seen).to.equal(1)

        expect(events[0]).to.exist
        expect(events[0]).to.have.property('intrinsics')
        expect(events[0].intrinsics.type).to.equal('Span')

        done()
      }, 10)
    })
  })

  it('should log span trace data when traceEnabled', () => {
    let ct = 0
    const fakeLogger = {
      traceEnabled: () => true,
      trace: () => ++ct,
      debug: () => {}
    }

    sinon.stub(logger, 'child').callsFake(() => fakeLogger)

    const spanEventAgg = new SpanEventAggregator({
      runId: RUN_ID,
      limit: LIMIT
    }, {}, new Metrics(5, {}, {}))

    spanEventAgg.send()
    logger.child.restore()

    expect(ct).to.equal(1)
  })

  it('should not log span trace data when !traceEnabled', () => {
    let ct = 0
    const fakeLogger = {
      traceEnabled: () => false,
      trace: () => ++ct,
      debug: () => {}
    }

    sinon.stub(logger, 'child').callsFake(() => fakeLogger)

    const spanEventAgg = new SpanEventAggregator({
      runId: RUN_ID,
      limit: LIMIT
    }, {}, new Metrics(5, {}, {}))

    spanEventAgg.send()
    logger.child.restore()

    expect(ct).to.equal(0)
  })
})
