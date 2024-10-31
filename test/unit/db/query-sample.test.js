/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const QuerySample = require('../../../lib/db/query-sample')
const codec = require('../../../lib/util/codec')

test('Query Sample', async (t) => {
  await t.test('should set trace to query with longest duration', () => {
    const trace = {
      duration: 3
    }
    const slowQuery = {
      duration: 30
    }
    const tracer = {}

    const querySample = new QuerySample(tracer, trace)
    querySample.aggregate(slowQuery)

    assert.equal(querySample.trace.duration, 30)
  })

  await t.test('should not set trace to query with shorter duration', () => {
    const trace = {
      duration: 30
    }
    const slowQuery = {
      duration: 3
    }
    const tracer = {}

    const querySample = new QuerySample(tracer, trace)
    querySample.aggregate(slowQuery)

    assert.equal(querySample.trace.duration, 30)
  })

  await t.test('should merge sample with longer duration', () => {
    const slowSample = {
      trace: {
        duration: 30
      }
    }
    const trace = {
      duration: 3
    }
    const tracer = {}

    const querySample = new QuerySample(tracer, trace)
    querySample.merge(slowSample)

    assert.equal(querySample.trace.duration, 30)
  })

  await t.test('should not merge sample with shorter duration', () => {
    const slowSample = {
      trace: {
        duration: 3
      }
    }
    const trace = {
      duration: 30
    }
    const tracer = {}

    const querySample = new QuerySample(tracer, trace)
    querySample.merge(slowSample)

    assert.equal(querySample.trace.duration, 30)
  })

  await t.test('should encode json when simple_compression is disabled', () => {
    const fakeTracer = {
      config: {
        simple_compression: false
      }
    }
    const fakeSample = {
      transaction: {},
      segment: {}
    }
    let codecCalled = false

    const fakeCodec = () => {
      codecCalled = true
    }
    sinon.stub(codec, 'encode').callsFake(fakeCodec)
    sinon.stub(QuerySample.prototype, 'getParams').callsFake(() => {})

    const querySample = new QuerySample(fakeTracer, fakeSample)

    querySample.prepareJSON(() => {})

    assert.ok(codecCalled)

    QuerySample.prototype.getParams.restore()
    codec.encode.restore()
  })

  await t.test('should call _getJSON when simple_compression is enabled', () => {
    const fakeTracer = {
      config: {
        simple_compression: true,
        transaction_tracer: {
          record_sql: '?'
        }
      }
    }

    let getFullNameCalled = false

    const fakeSample = {
      transaction: {
        getFullName: () => {
          getFullNameCalled = true
        }
      },
      segment: {}
    }

    const clock = sinon.useFakeTimers({
      toFake: ['nextTick']
    })
    process.nextTick(() => {})

    sinon.stub(QuerySample.prototype, 'getParams').callsFake(() => {})

    const querySample = new QuerySample(fakeTracer, fakeSample)

    querySample.prepareJSON(() => {})

    clock.runAll()

    assert.ok(getFullNameCalled)

    clock.restore()
    QuerySample.prototype.getParams.restore()
  })

  await t.test('should return segment attributes as params if present', () => {
    const expectedParams = {
      host: 'host',
      port_path_or_id: 1,
      database_name: 'dbname'
    }
    const fakeTracer = {
      config: {
        distributed_tracing: {
          enabled: true
        }
      }
    }
    const fakeGetAttributes = () => expectedParams
    const fakeSample = {
      trace: {},
      transaction: {
        addDistributedTraceIntrinsics: () => {}
      },
      segment: {
        getAttributes: fakeGetAttributes
      }
    }

    const querySample = new QuerySample(fakeTracer, fakeSample)

    const result = querySample.getParams()

    assert.equal(result.host, expectedParams.host)
    assert.equal(result.port_path_or_id, expectedParams.port_path_or_id)
    assert.equal(result.database_name, expectedParams.database_name)
  })

  await t.test('should add DT intrinsics when DT enabled', () => {
    let addDtIntrinsicsCalled = false
    const fakeTracer = {
      config: {
        distributed_tracing: {
          enabled: true
        }
      }
    }
    const fakeSample = {
      trace: {},
      transaction: {
        addDistributedTraceIntrinsics: () => {
          addDtIntrinsicsCalled = true
        }
      },
      segment: {
        getAttributes: () => ({})
      }
    }

    const querySample = new QuerySample(fakeTracer, fakeSample)

    querySample.getParams()

    assert.equal(addDtIntrinsicsCalled, true)
  })

  await t.test('should not add DT intrinsics when DT disabled', () => {
    let addDtIntrinsicsCalled = false
    const fakeTracer = {
      config: {
        distributed_tracing: {
          enabled: false
        }
      }
    }
    const fakeSample = {
      trace: {},
      transaction: {
        addDistributedTraceIntrinsics: () => {
          addDtIntrinsicsCalled = true
        }
      },
      segment: {
        getAttributes: () => ({})
      }
    }

    const querySample = new QuerySample(fakeTracer, fakeSample)

    querySample.getParams()

    assert.equal(addDtIntrinsicsCalled, false)
  })
})
