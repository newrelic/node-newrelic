'use strict'

const expect = require('chai').expect
const sinon = require('sinon')
const QuerySample = require('../../../lib/db/query-sample')
const codec = require('../../../lib/util/codec')

describe('Query Sample', function testQuerySample() {
  it('should set trace to query with longest duration', () => {
    const trace = {
      duration: 3
    }
    const slowQuery = {
      duration: 30
    }
    const tracer = {}

    const querySample = new QuerySample(tracer, trace)
    querySample.aggregate(slowQuery)

    expect(querySample.trace.duration).to.equal(30)
  })

  it('should not set trace to query with shorter duration', () => {
    const trace = {
      duration: 30
    }
    const slowQuery = {
      duration: 3
    }
    const tracer = {}

    const querySample = new QuerySample(tracer, trace)
    querySample.aggregate(slowQuery)

    expect(querySample.trace.duration).to.equal(30)
  })

  it('should merge sample with longer duration', () => {
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

    expect(querySample.trace.duration).to.equal(30)
  })

  it('should not merge sample with shorter duration', () => {
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

    expect(querySample.trace.duration).to.equal(30)
  })

  it('should encode json when simple_compression is disabled', () => {
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
    
    expect(codecCalled).to.be.true

    QuerySample.prototype.getParams.restore()
    codec.encode.restore()
  })

  it('should call _getJSON when simple_compression is enabled', () => {
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
    
    expect(getFullNameCalled).to.be.true

    clock.restore()
    QuerySample.prototype.getParams.restore()
  })

  it('should return segment attributes as params if present', () => {
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

    expect(result.host).to.equal(expectedParams.host)
    expect(result.port_path_or_id).to.equal(expectedParams.port_path_or_id)
    expect(result.database_name).to.equal(expectedParams.database_name)
  })

  it('should add DT intrinsics when DT enabled', () => {
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

    expect(addDtIntrinsicsCalled).to.be.true
  })

  it('should not add DT intrinsics when DT disabled', () => {
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

    expect(addDtIntrinsicsCalled).to.be.false
  })
})
