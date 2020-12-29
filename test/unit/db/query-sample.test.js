/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const QuerySample = require('../../../lib/db/query-sample')
const codec = require('../../../lib/util/codec')

tap.test('Query Sample', (t) => {
  t.autoend()

  t.test('should set trace to query with longest duration', (t) => {
    const trace = {
      duration: 3
    }
    const slowQuery = {
      duration: 30
    }
    const tracer = {}

    const querySample = new QuerySample(tracer, trace)
    querySample.aggregate(slowQuery)

    t.equal(querySample.trace.duration, 30)

    t.end()
  })

  t.test('should not set trace to query with shorter duration', (t) => {
    const trace = {
      duration: 30
    }
    const slowQuery = {
      duration: 3
    }
    const tracer = {}

    const querySample = new QuerySample(tracer, trace)
    querySample.aggregate(slowQuery)

    t.equal(querySample.trace.duration, 30)

    t.end()
  })

  t.test('should merge sample with longer duration', (t) => {
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

    t.equal(querySample.trace.duration, 30)

    t.end()
  })

  t.test('should not merge sample with shorter duration', (t) => {
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

    t.equal(querySample.trace.duration, 30)

    t.end()
  })

  t.test('should encode json when simple_compression is disabled', (t) => {
    const fakeTracer = {
      config: {
        simple_compression: false
      }
    }
    const fakeSample = {
      segment: {
        transaction: {}
      }
    }
    let codecCalled = false

    const fakeCodec = () => {
      codecCalled = true
    }
    sinon.stub(codec, 'encode').callsFake(fakeCodec)
    sinon.stub(QuerySample.prototype, 'getParams').callsFake(() => {})

    const querySample = new QuerySample(fakeTracer, fakeSample)

    querySample.prepareJSON(() => {})

    t.ok(codecCalled)

    QuerySample.prototype.getParams.restore()
    codec.encode.restore()

    t.end()
  })

  t.test('should call _getJSON when simple_compression is enabled', (t) => {
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
      segment: {
        transaction: {
          getFullName: () => {
            getFullNameCalled = true
          }
        }
      }
    }

    const clock = sinon.useFakeTimers({
      toFake: ['nextTick']
    })
    process.nextTick(() => {})

    sinon.stub(QuerySample.prototype, 'getParams').callsFake(() => {})

    const querySample = new QuerySample(fakeTracer, fakeSample)

    querySample.prepareJSON(() => {})

    clock.runAll()

    t.ok(getFullNameCalled)

    clock.restore()
    QuerySample.prototype.getParams.restore()

    t.end()
  })

  t.test('should return segment attributes as params if present', (t) => {
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
      segment: {
        getAttributes: fakeGetAttributes,
        transaction: {
          addDistributedTraceIntrinsics: () => {}
        }
      }
    }

    const querySample = new QuerySample(fakeTracer, fakeSample)

    const result = querySample.getParams()

    t.equal(result.host, expectedParams.host)
    t.equal(result.port_path_or_id, expectedParams.port_path_or_id)
    t.equal(result.database_name, expectedParams.database_name)

    t.end()
  })

  t.test('should add DT intrinsics when DT enabled', (t) => {
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
      segment: {
        getAttributes: () => ({}),
        transaction: {
          addDistributedTraceIntrinsics: () => {
            addDtIntrinsicsCalled = true
          }
        }
      }
    }

    const querySample = new QuerySample(fakeTracer, fakeSample)

    querySample.getParams()

    t.equal(addDtIntrinsicsCalled, true)

    t.end()
  })

  t.test('should not add DT intrinsics when DT disabled', (t) => {
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
      segment: {
        getAttributes: () => ({}),
        transaction: {
          addDistributedTraceIntrinsics: () => {
            addDtIntrinsicsCalled = true
          }
        }
      }
    }

    const querySample = new QuerySample(fakeTracer, fakeSample)

    querySample.getParams()

    t.equal(addDtIntrinsicsCalled, false)

    t.end()
  })
})
