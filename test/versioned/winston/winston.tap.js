/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const concat = require('concat-stream')
const API = require('../../../api')

tap.test('Winston instrumentation', { bail: true }, (t) => {
  t.autoend()

  let agent
  let winston
  let api

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()
    api = new API(agent)
    winston = require('winston')
  })

  t.afterEach(() => {
    agent && helper.unloadAgent(agent)
    api = null
    winston = null
    // must purge require cache of winston related instrumentation
    // otherwise it will not re-register on subsequent test runs
    Object.keys(require.cache).forEach((key) => {
      if (/winston/.test(key)) {
        delete require.cache[key]
      }
    })
  })

  // Keep track of the number of streams that we're waiting to close and test.  Also clean
  // up the info object used by winston/logform to make it easier to test.
  function makeStreamTest(t) {
    let toBeClosed = 0

    // Assert function will receive log strings to be tested
    return function streamTest(assertFn) {
      // When creating a stream test, increment the number of streams to wait to close.
      ++toBeClosed

      // This function will be given to `concat` and will receive an array of messages
      // from Winston when the stream closes.
      return function (msgs) {
        // We only want the log string from the message object. This is stored on the
        // object on a key that is a symbol. Grab that and give it to the assert function.
        const logStrings = msgs.map((msg) => {
          const symbols = Object.getOwnPropertySymbols(msg)
          const msgSym = symbols.filter((s) => s.toString() === 'Symbol(message)')[0]
          return msg[msgSym]
        })

        assertFn(logStrings)

        // If this function is called it is because the stream closed. Decrement the
        // number of streams we're waiting for and end the test if it's the last one.
        if (--toBeClosed === 0) {
          t.end()
        }
      }
    }
  }

  // Helper function to compare a json-parsed log msg against the values we expect.
  function validateAnnotations(t, msg, expected) {
    Object.keys(expected).forEach((a) => {
      const ex = expected[a]
      t.type(msg[a], ex.type, `should have the proper keys (${a})`)
      if (ex.val != null) {
        t.equal(msg[a], ex.val, `should have the expected value (${a})`)
      }
    })
  }

  t.test('should add linking metadata to default logs', (t) => {
    const config = agent.config

    // These values should be added by the instrumentation even when not in a transaction.
    const basicAnnotations = {
      'entity.name': {
        type: 'string',
        val: config.applications()[0]
      },
      'entity.type': {
        type: 'string',
        val: 'SERVICE'
      },
      'hostname': {
        type: 'string',
        val: config.getHostnameSafe()
      }
    }

    // These should show up in the JSON via the combined formatters in the winston config.
    const loggingAnnotations = {
      timestamp: {
        type: 'number'
      }
    }

    // These will be assigned when inside a transaction below and should be in the JSON.
    let transactionAnnotations

    const streamTest = makeStreamTest(t)

    // These streams are passed to the Winston config below to capture the
    // output of the logging. `concat` captures all of a stream and passes it to
    // the given function.
    const jsonStream = concat(
      streamTest((msgs) => {
        msgs.forEach((msg) => {
          // Make sure the JSON stream actually gets JSON
          let msgJson
          t.doesNotThrow(() => (msgJson = JSON.parse(msg)), 'should be JSON')

          // Verify the proper keys are there
          validateAnnotations(t, msgJson, basicAnnotations)
          validateAnnotations(t, msgJson, loggingAnnotations)

          // Test that transaction keys are there if in a transaction
          if (msgJson.message === 'in trans') {
            validateAnnotations(t, msgJson, transactionAnnotations)
          }
        })
      })
    )

    const simpleStream = concat(
      streamTest((msgs) => {
        msgs.forEach((msg) => {
          t.throws(() => JSON.parse(msg), 'should not be json parsable')
          t.notOk(/timestamp/.exec(msg), 'should clean up timestamp generation')
          t.ok(/^info:.*trans$/.exec(msg), 'should not have metadata keys')
        })
      })
    )

    // Example Winston setup to test
    const logger = winston.createLogger({
      transports: [
        // Log to a stream so we can test the output
        new winston.transports.Stream({
          level: 'info',
          stream: jsonStream
        }),
        new winston.transports.Stream({
          level: 'info',
          format: winston.format.simple(),
          stream: simpleStream
        })
      ]
    })

    // Log some stuff, both in and out of a transaction
    logger.info('out of trans')

    helper.runInTransaction(agent, 'test', () => {
      logger.info('in trans')

      const metadata = api.getLinkingMetadata()
      // Capture info about the transaction that should show up in the logs
      transactionAnnotations = {
        'trace.id': {
          type: 'string',
          val: metadata['trace.id']
        },
        'span.id': {
          type: 'string',
          val: metadata['span.id']
        }
      }

      // Force the streams to close so that we can test the output
      jsonStream.end()
      simpleStream.end()
    })
  })

  t.test('should add linking metadata to JSON logs', (t) => {
    const config = agent.config

    // These should show up in the JSON via the combined formatters in the winston config.
    const loggingAnnotations = {
      timestamp: {
        type: 'number'
      },
      original_timestamp: {
        type: 'string',
        val: new Date().getFullYear().toString()
      },
      label: {
        type: 'string',
        val: 'test'
      }
    }

    // These values should be added by the instrumentation even when not in a transaction.
    const basicAnnotations = {
      'entity.name': {
        type: 'string',
        val: config.applications()[0]
      },
      'entity.type': {
        type: 'string',
        val: 'SERVICE'
      },
      'hostname': {
        type: 'string',
        val: config.getHostnameSafe()
      }
    }

    // These will be assigned when inside a transaction below and should be in the JSON.
    let transactionAnnotations

    const streamTest = makeStreamTest(t)

    // These streams are passed to the Winston config below to capture the
    // output of the logging. `concat` captures all of a stream and passes it to
    // the given function.
    const jsonStream = concat(
      streamTest((msgs) => {
        msgs.forEach((msg) => {
          // Make sure the JSON stream actually gets JSON
          let msgJson
          t.doesNotThrow(() => (msgJson = JSON.parse(msg)), 'should be JSON')

          // Verify the proper keys are there
          validateAnnotations(t, msgJson, basicAnnotations)
          validateAnnotations(t, msgJson, loggingAnnotations)

          // Test that transaction keys are there if in a transaction
          if (msgJson.message === 'in trans') {
            validateAnnotations(t, msgJson, transactionAnnotations)
          }
        })
      })
    )

    const simpleStream = concat(
      streamTest((msgs) => {
        msgs.forEach((msg) => {
          t.throws(() => JSON.parse(msg), 'should not be json parsable')
          t.notOk(/original_timestamp/.exec(msg), 'should clean up timestamp reassignment')
          t.ok(/^info:.*trans$/.exec(msg), 'should not have metadata keys')
        })
      })
    )

    // Example Winston setup to test
    const logger = winston.createLogger({
      transports: [
        // Log to a stream so we can test the output
        new winston.transports.Stream({
          level: 'info',
          // Format combos are used here to test that the shim doesn't affect
          // format piping
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY' }),
            winston.format.label({ label: 'test' })
          ),
          stream: jsonStream
        }),
        new winston.transports.Stream({
          level: 'info',
          format: winston.format.simple(),
          stream: simpleStream
        })
      ]
    })

    // Log some stuff, both in and out of a transaction
    logger.info('out of trans')

    helper.runInTransaction(agent, 'test', () => {
      logger.info('in trans')

      const metadata = api.getLinkingMetadata()
      // Capture info about the transaction that should show up in the logs
      transactionAnnotations = {
        'trace.id': {
          type: 'string',
          val: metadata['trace.id']
        },
        'span.id': {
          type: 'string',
          val: metadata['span.id']
        }
      }

      // Force the streams to close so that we can test the output
      jsonStream.end()
      simpleStream.end()
    })
  })

  t.test('should add error metadata to JSON logs', (t) => {
    // These should show up in the JSON via the combined formatters in the winston config.
    const annotations = {
      'error.message': {
        type: 'string',
        val: 'test error message'
      },
      'error.class': {
        type: 'string',
        val: 'TestError'
      },
      'error.stack': {
        type: 'string'
      }
    }

    // These streams are passed to the Winston config below to capture the output of the
    // logging. `concat` captures all of a stream and passes it to the given function.
    const errorStream = concat(
      makeStreamTest(t)((msgs) => {
        msgs.forEach((msg) => {
          let msgJson
          t.doesNotThrow(() => (msgJson = JSON.parse(msg)), 'should be JSON')
          validateAnnotations(t, msgJson, annotations)
          t.ok(msgJson['error.message'], 'Error messages are captured')
          t.ok(msgJson['error.class'], 'Error classes are captured')
          t.ok(msgJson['error.stack'], 'Error stack traces are captured')
          t.notOk(msgJson.stack, 'Stack removed from JSON')
          t.notOk(msgJson.trace, 'trace removed from JSON')
        })
      })
    )

    // Example Winston setup to test
    winston.createLogger({
      // There is a bug in winston around piping exception handler data
      // into the underlying transport that skips the formatters. To
      // get around this, move the `exceptionHandlers` into `transports` and
      // set the `handleExceptions` option to `true`.
      transports: [
        new winston.transports.Stream({
          level: 'info',
          handleExceptions: true,
          stream: errorStream
        })
      ],
      exitOnError: false
    })

    helper.runInTransaction(agent, 'test', () => {
      // Simulate an error being thrown to trigger Winston's error handling
      class TestError extends Error {
        constructor(msg) {
          super(msg)
          this.name = 'TestError'
        }
      }
      process.emit('uncaughtException', new TestError('test error message'))
      const metadata = api.getLinkingMetadata()

      // Capture info about the transaction that should show up in the logs
      annotations['trace.id'] = { type: 'string', val: metadata['trace.id'] }
      annotations['span.id'] = { type: 'string', val: metadata['span.id'] }

      // Force the stream to close so that we can test the output
      errorStream.end()
    })
  })

  t.test('should still log user data when agent disabled', (t) => {
    // These should show up in the JSON via the combined formatters in the winston config.
    const loggingAnnotations = {
      timestamp: {
        type: 'string' // original format
      },
      label: {
        type: 'string',
        val: 'test'
      }
    }

    const streamTest = makeStreamTest(t)

    // These streams are passed to the Winston config below to capture the
    // output of the logging. `concat` captures all of a stream and passes it to
    // the given function.
    const jsonStream = concat(
      streamTest((msgs) => {
        tap.equal(msgs.length, 2)
        msgs.forEach((msg) => {
          // Make sure the JSON stream actually gets JSON
          let msgJson
          t.doesNotThrow(() => (msgJson = JSON.parse(msg)), 'should be JSON')

          // Verify the proper keys are there
          validateAnnotations(t, msgJson, loggingAnnotations)
        })
      })
    )

    const simpleStream = concat(
      streamTest((msgs) => {
        msgs.forEach((msg) => {
          t.throws(() => JSON.parse(msg), 'should not be json parsable')
          t.notOk(/original_timestamp/.exec(msg), 'should clean up timestamp reassignment')
          t.ok(/^info:.*trans$/.exec(msg), 'should not have metadata keys')
        })
      })
    )

    // Example Winston setup to test
    const logger = winston.createLogger({
      transports: [
        // Log to a stream so we can test the output
        new winston.transports.Stream({
          level: 'info',
          // Format combos are used here to test that the shim doesn't affect
          // format piping
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY' }),
            winston.format.label({ label: 'test' })
          ),
          stream: jsonStream
        }),
        new winston.transports.Stream({
          level: 'info',
          format: winston.format.simple(),
          stream: simpleStream
        })
      ]
    })

    // Log some stuff, both in and out of a transaction
    logger.info('out of trans')

    helper.runInTransaction(agent, 'test', () => {
      logger.info('in trans')

      // Force the streams to close so that we can test the output
      jsonStream.end()
      simpleStream.end()
    })
  })
})
