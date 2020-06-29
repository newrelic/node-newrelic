/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */


'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const expect = require('chai').expect
const ErrorTraceAggregator = require('../../../lib/errors/error-trace-aggregator')

const RUN_ID = 1337
const LIMIT = 5

describe('Error Trace Aggregator', () => {
  let errorTraceAggregator

  beforeEach(() => {
    errorTraceAggregator = new ErrorTraceAggregator({
      runId: RUN_ID,
      limit: LIMIT
    })
  })

  afterEach(() => {
    errorTraceAggregator = null
  })

  it('should set the correct default method', () => {
    const method = errorTraceAggregator.method

    expect(method).to.equal('error_data')
  })

  it('add() should add errors', () => {
    const rawErrorTrace = [0, 'name', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const firstError = errorTraceAggregator.errors[0]
    expect(rawErrorTrace).to.equal(firstError)
  })

  it('_getMergeData() should return errors', () => {
    const rawErrorTrace = [0, 'name', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const data = errorTraceAggregator._getMergeData()
    expect(data.length).to.equal(1)

    const firstError = data[0]
    expect(rawErrorTrace).to.equal(firstError)
  })

  it('toPayloadSync() should return json format of data', () => {
    const rawErrorTrace = [0, 'name', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const payload = errorTraceAggregator._toPayloadSync()
    expect(payload.length).to.equal(2)

    const [runId, errorTraceData] = payload
    expect(runId).to.equal(RUN_ID)

    const expectedTraceData = [rawErrorTrace]
    expect(errorTraceData).to.deep.equal(expectedTraceData)
  })

  it('toPayload() should return json format of data', () => {
    const rawErrorTrace = [0, 'name', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    errorTraceAggregator._toPayload((err, payload) => {
      expect(payload.length).to.equal(2)

      const [runId, errorTraceData] = payload
      expect(runId).to.equal(RUN_ID)

      const expectedTraceData = [rawErrorTrace]
      expect(errorTraceData).to.deep.equal(expectedTraceData)
    })
  })

  it('_merge() should merge passed-in data in order', () => {
    const rawErrorTrace = [0, 'name1', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const mergeData = [
      [0, 'name2', 'message', 'type', {}],
      [0, 'name3', 'message', 'type', {}]
    ]

    errorTraceAggregator._merge(mergeData)

    expect(errorTraceAggregator.errors.length).to.equal(3)

    const [error1, error2, error3] = errorTraceAggregator.errors
    expect(error1[1]).to.equal('name1')
    expect(error2[1]).to.equal('name2')
    expect(error3[1]).to.equal('name3')
  })

  it('_merge() should not merge past limit', () => {
    const rawErrorTrace = [0, 'name1', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const mergeData = [
      [0, 'name2', 'message', 'type', {}],
      [0, 'name3', 'message', 'type', {}],
      [0, 'name4', 'message', 'type', {}],
      [0, 'name5', 'message', 'type', {}],
      [0, 'name6', 'message', 'type', {}]
    ]

    errorTraceAggregator._merge(mergeData)

    expect(errorTraceAggregator.errors.length).to.equal(LIMIT)

    const [error1, error2, error3, error4, error5] = errorTraceAggregator.errors
    expect(error1[1]).to.equal('name1')
    expect(error2[1]).to.equal('name2')
    expect(error3[1]).to.equal('name3')
    expect(error4[1]).to.equal('name4')
    expect(error5[1]).to.equal('name5')
  })

  it('clear() should clear errors', () => {
    const rawErrorTrace = [0, 'name1', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    expect(errorTraceAggregator.errors.length).to.equal(1)

    errorTraceAggregator.clear()

    expect(errorTraceAggregator.errors.length).to.equal(0)
  })
})
