/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const expect = require('chai').expect

const headerProcessing = require('../../lib/header-processing')

describe('header-processing', () => {
  describe('#getContentLengthFromHeaders', () => {
    it('should return content-length headers, case insensitive', () => {
      // does it work?
      expect(headerProcessing.getContentLengthFromHeaders({ 'Content-Length': 100 })).to.equal(100)

      // does it work with weird casing?
      expect(headerProcessing.getContentLengthFromHeaders({ 'ConTent-LenGth': 100 })).to.equal(100)

      // does it ignore other headers?
      expect(
        headerProcessing.getContentLengthFromHeaders({
          'zip': 'zap',
          'Content-Length': 100,
          'foo': 'bar'
        })
      ).to.equal(100)

      // does it return _exactly_, type including, what's in the header
      // this captures the exact behavior of the legacy code
      expect(
        headerProcessing.getContentLengthFromHeaders({
          'zip': 'zap',
          'Content-Length': '100',
          'foo': 'bar'
        })
      ).to.equal('100')

      // when presented with two headers that are the same name
      // but different case, does it prefer the first one found.
      // This captures the exact behavior of the legacy code we're
      // replacing
      expect(
        headerProcessing.getContentLengthFromHeaders({
          'zip': 'zap',
          'content-length': 50,
          'Content-Length': 100,
          'foo': 'bar'
        })
      ).to.equal(50)

      // doesn't fail when working with null prototype objects
      // (returned by res.getHeaders() is -- some? all? versions
      // of NodeJS
      const fixture = Object.create(null)
      fixture.zip = 'zap'
      fixture['content-length'] = 49
      fixture['Content-Length'] = 100
      fixture.foo = 'bar'
      expect(headerProcessing.getContentLengthFromHeaders(fixture)).to.equal(49)
    })

    it('should return -1 if there is no header', () => {
      expect(headerProcessing.getContentLengthFromHeaders({})).to.equal(-1)

      expect(headerProcessing.getContentLengthFromHeaders('foo')).to.equal(-1)

      expect(headerProcessing.getContentLengthFromHeaders([])).to.equal(-1)

      expect(headerProcessing.getContentLengthFromHeaders({ foo: 'bar', zip: 'zap' })).to.equal(-1)
    })
  })

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
