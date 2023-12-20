/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const headerProcessing = require('../../lib/header-processing')

tap.test('header-processing', (t) => {
  t.test('#getContentLengthFromHeaders', (t) => {
    t.test('should return content-length headers, case insensitive', (t) => {
      // does it work?
      t.equal(headerProcessing.getContentLengthFromHeaders({ 'Content-Length': 100 }), 100)

      // does it work with weird casing?
      t.equal(headerProcessing.getContentLengthFromHeaders({ 'ConTent-LenGth': 100 }), 100)

      // does it ignore other headers?
      t.equal(
        headerProcessing.getContentLengthFromHeaders({
          'zip': 'zap',
          'Content-Length': 100,
          'foo': 'bar'
        }),
        100
      )

      // when presented with two headers that are the same name
      // but different case, does t.test prefer the first one found.
      // This captures the exact behavior of the legacy code we're
      // replacing
      t.equal(
        headerProcessing.getContentLengthFromHeaders({
          'zip': 'zap',
          'content-length': 50,
          'Content-Length': 100,
          'foo': 'bar'
        }),
        50
      )

      // doesn't fail when working with null prototype objects
      // (returned by res.getHeaders() is -- some? all? versions
      // of NodeJS
      const fixture = Object.create(null)
      fixture.zip = 'zap'
      fixture['content-length'] = 49
      fixture['Content-Length'] = 100
      fixture.foo = 'bar'
      t.equal(headerProcessing.getContentLengthFromHeaders(fixture), 49)
      t.end()
    })

    t.test('should return -1 if there is no header', (t) => {
      t.equal(headerProcessing.getContentLengthFromHeaders({}), -1)

      t.equal(headerProcessing.getContentLengthFromHeaders('foo'), -1)

      t.equal(headerProcessing.getContentLengthFromHeaders([]), -1)

      t.equal(headerProcessing.getContentLengthFromHeaders({ foo: 'bar', zip: 'zap' }), -1)
      t.end()
    })
    t.end()
  })

  t.test('#getQueueTime', (t) => {
    // This header can hold up to 4096 bytes which could quickly fill up logs.
    // Do not log a level higher than debug.
    t.test('should not log invalid raw queue time higher than debug level', (t) => {
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

      t.not(queueTime)
      t.equal(didLogHighLevel, false)
      t.equal(didLogLowLevel, true)
      t.end()

      function didLogRawQueueTime(args) {
        let didLog = false

        args.forEach((argument) => {
          const foundQueueTime = argument.indexOf(invalidRawQueueTime) >= 0
          if (foundQueueTime) {
            didLog = true
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
    t.end()
  })
  t.end()
})
