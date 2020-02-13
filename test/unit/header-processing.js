'use strict'

const expect = require('chai').expect

const headerProcessing = require('../../lib/header-processing')

describe('header-processing', () => {
  describe('#getQueueTime', () => {
    // This header can hold up to 4096 bytes which could quickly fill up logs.
    // Do not log a level higher than debug.
    it('should not log invalid raw queue time higher than debug level', () => {
      const invalidRawQueueTime = 'z1232442z'
      const requestHeaders = {
        'x-queue-start': invalidRawQueueTime
      }

      let didLogHighLevel = false
      let didLogLowLevel = false

      const mockLogger = {
        trace: checkLogRawQueueTimeLowLevel,
        debug: checkLogRawQueueTimeLowLevel,
        info: checkLogRawQueueTimeHighLevel,
        warn: checkLogRawQueueTimeHighLevel,
        error: checkLogRawQueueTimeHighLevel
      }

      const queueTime = headerProcessing.getQueueTime(mockLogger, requestHeaders)

      expect(queueTime).to.not.exist
      expect(didLogHighLevel).to.be.false
      expect(didLogLowLevel).to.be.true

      function didLogRawQueueTime(args) {
        let didLog = false

        args.forEach((argument) => {
          const foundQueueTime = argument.indexOf(invalidRawQueueTime) >= 0
          if (foundQueueTime) {
            didLog = true
            return
          }
        })

        return didLog
      }

      function checkLogRawQueueTimeHighLevel(...args) {
        if (didLogRawQueueTime(args)) {
          didLogHighLevel = true
        }
      }

      function checkLogRawQueueTimeLowLevel(...args) {
        if (didLogRawQueueTime(args)) {
          didLogLowLevel = true
        }
      }
    })
  })
})

