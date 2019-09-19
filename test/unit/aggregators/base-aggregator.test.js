'use strict'

const expect = require('chai').expect
const sinon = require('sinon')
const Aggregator = require('../../../lib/aggregators/base-aggregator')

const RUN_ID = 1337
const LIMIT = 5
const PERIOD_MS = 5
const METHOD = 'some_method'

describe('Base Aggregator', () => {
  let baseAggregator = null
  let fakeCollectorApi = null

  beforeEach(() => {
    fakeCollectorApi = {}
    fakeCollectorApi[METHOD] = () => {}

    baseAggregator = new Aggregator({
      periodMs: PERIOD_MS,
      runId: RUN_ID,
      limit: LIMIT,
      method: METHOD
    }, fakeCollectorApi)
  })

  afterEach(() => {
    baseAggregator = null
    fakeCollectorApi = null
  })

  describe('scheduling', () => {
    let sendInvocation = 0
    let clock = null

    beforeEach(() => {
      // Keep track of send invocations, avoiding rest of functionality
      sendInvocation = 0
      baseAggregator.send = () => sendInvocation++

      clock = sinon.useFakeTimers()
    })

    afterEach(() => {
      clock.restore()
      clock = null

      sendInvocation = 0
    })

    describe('start()', () => {
      it('should consistently invoke send on period', () => {
        baseAggregator.start()

        clock.tick(PERIOD_MS)

        expect(sendInvocation).to.equal(1)

        clock.tick(PERIOD_MS)

        expect(sendInvocation).to.equal(2)
      })

      it('should not schedule multiple timers once started', () => {
        baseAggregator.start()
        baseAggregator.start()

        clock.tick(PERIOD_MS)

        expect(sendInvocation).to.equal(1)

        clock.tick(PERIOD_MS)

        expect(sendInvocation).to.equal(2)
      })
    })

    describe('stop()', () => {
      it('should stop invoking send on period', () => {
        baseAggregator.start()

        clock.tick(PERIOD_MS)

        expect(sendInvocation).to.equal(1)

        baseAggregator.stop()

        clock.tick(PERIOD_MS)

        expect(sendInvocation).to.equal(1)
      })

      it('should stop gracefully handle stop when not started', () => {
        baseAggregator.stop()

        clock.tick(PERIOD_MS)

        expect(sendInvocation).to.equal(0)
      })

      it('should stop gracefully handle stop when already stopped', () => {
        baseAggregator.start()

        clock.tick(PERIOD_MS)

        expect(sendInvocation).to.equal(1)

        baseAggregator.stop()
        baseAggregator.stop()

        clock.tick(PERIOD_MS)

        expect(sendInvocation).to.equal(1)
      })
    })
  })

  describe('send()', () => {
    it('should emit proper message with method for starting send', () => {
      baseAggregator._getMergeData = () => null
      baseAggregator._toPayloadSync = () => null
      baseAggregator.clear = () => {}

      const expectedStartEmit = `starting ${METHOD} data send.`

      let emitFired = false
      baseAggregator.once(expectedStartEmit, () => {
        emitFired = true
      })

      baseAggregator.send()

      expect(emitFired).to.be.true
    })

    it('should clear existing data', () => {
      // Keep track of clear invocations
      let clearInvocations = 0
      baseAggregator.clear = () => clearInvocations++

      // Pretend there's data to clear
      baseAggregator._getMergeData = () => ['data']
      baseAggregator._toPayloadSync = () => ['data']

      baseAggregator.send()

      expect(clearInvocations).to.equal(1)
    })

    it('should call transport w/ correct payload', () => {
      // stub to allow invocation
      baseAggregator.clear = () => {}

      const expectedPayload = ['payloadData']

      // Pretend there's data to clear
      baseAggregator._getMergeData = () => ['rawData']
      baseAggregator._toPayloadSync = () => expectedPayload

      let invokedPayload = null

      fakeCollectorApi[METHOD] = (payload) => {
        invokedPayload = payload
      }


      baseAggregator.send()

      expect(invokedPayload).to.deep.equal(expectedPayload)
    })

    it('should not call transport for no data', () => {
      // Pretend there's data to clear
      baseAggregator._getMergeData = () => null
      baseAggregator._toPayloadSync = () => null
      baseAggregator.clear = () => {}

      let transportInvocations = 0
      fakeCollectorApi[METHOD] = () => {
        transportInvocations++
      }

      baseAggregator.send()

      expect(transportInvocations).to.equal(0)
    })

    it('should call merge with original data when transport indicates retain', () => {
      // stub to allow invocation
      baseAggregator.clear = () => {}

      const expectedData = ['payloadData']

      // Pretend there's data to clear
      baseAggregator._getMergeData = () => expectedData
      baseAggregator._toPayloadSync = () => ['payloadData']

      let mergeData = null
      baseAggregator._merge = (data) => {
        mergeData = data
      }

      fakeCollectorApi[METHOD] = (payload, callback) => {
        callback(null, { retainData: true})
      }

      baseAggregator.send()

      expect(mergeData).to.deep.equal(expectedData)
    })

    it('should not merge when transport indicates not to retain', () => {
      // stub to allow invocation
      baseAggregator.clear = () => {}

      const expectedData = ['payloadData']

      // Pretend there's data to clear
      baseAggregator._getMergeData = () => expectedData
      baseAggregator._toPayloadSync = () => ['payloadData']

      let mergeInvocations = 0
      baseAggregator._merge = () => {
        mergeInvocations++
      }

      fakeCollectorApi[METHOD] = (payload, callback) => {
        callback(null, { retainData: false})
      }

      baseAggregator.send()

      expect(mergeInvocations).to.equal(0)
    })

    it('should default to the sync method in the async case with no override', () => {
      // stub to allow invocation
      baseAggregator.clear = () => {}

      const expectedData = ['payloadData']

      // Pretend there's data to clear
      baseAggregator._getMergeData = () => expectedData
      baseAggregator._toPayloadSync = () => ['payloadData']

      // Set the aggregator up as async
      baseAggregator.isAsync = true

      let mergeInvocations = 0
      baseAggregator._merge = () => {
        mergeInvocations++
      }

      fakeCollectorApi[METHOD] = (payload, callback) => {
        callback(null, { retainData: false})
      }

      baseAggregator.send()

      expect(mergeInvocations).to.equal(0)
    })

    it('should allow for async payload override', () => {
      // stub to allow invocation
      baseAggregator.clear = () => {}

      const expectedData = ['payloadData']

      // Pretend there's data to clear
      baseAggregator._getMergeData = () => expectedData
      baseAggregator.toPayload = (cb) => cb(null, ['payloadData'])

      // Set the aggregator up as async
      baseAggregator.isAsync = true

      let mergeInvocations = 0
      baseAggregator._merge = () => {
        mergeInvocations++
      }

      fakeCollectorApi[METHOD] = (payload, callback) => {
        callback(null, { retainData: false})
      }

      baseAggregator.send()

      expect(mergeInvocations).to.equal(0)
    })

    it('should emit proper message with method for finishing send', () => {
      // stub to allow invocation
      baseAggregator.clear = () => {}
      baseAggregator._getMergeData = () => ['data']
      baseAggregator._toPayloadSync = () => ['data']

      const expectedStartEmit = `finished ${METHOD} data send.`

      let emitFired = false
      baseAggregator.once(expectedStartEmit, () => {
        emitFired = true
      })

      fakeCollectorApi[METHOD] = (payload, callback) => {
        callback(null, { retainData: false})
      }

      baseAggregator.send()

      expect(emitFired).to.be.true
    })
  })

  it('reconfigure() should update runid', () => {
    const expectedRunId = 'new run id'
    const fakeConfig = {run_id: expectedRunId}

    baseAggregator.reconfigure(fakeConfig)

    expect(baseAggregator.runId).to.equal(expectedRunId)
  })
})
