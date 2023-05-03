/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const nock = require('nock')
const path = require('path')
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')

const helper = require('../lib/agent_helper')

const PROTO_PATH = path.join(__dirname, '../..', '/lib/grpc/endpoints/infinite-tracing/v1.proto')

const TEST_DOMAIN = 'test-collector.newrelic.com'
const TEST_COLLECTOR_URL = `https://${TEST_DOMAIN}`

// This key is hardcoded in the agent helper
const EXPECTED_LICENSE_KEY = 'license key here'
const INITIAL_RUN_ID = 'initial_run_id'
const INITIAL_SESSION_ID = 'initial_session_id'

const EXPECTED_SEGMENT_NAME = 'Test Segment'
const EXPECTED_SEGMENT_NAME_2 = 'Test Segment 2'

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
})

tap.Test.prototype.addAssert('batch', 1, function assertBatch(spans) {
  this.ok(spans.length === 2, 'should have 2 spans')

  spans.forEach((span, i) => {
    const { name } = span.intrinsics

    if (i === 0) {
      this.equal(name.string_value, EXPECTED_SEGMENT_NAME)
    } else {
      this.equal(name.string_value, EXPECTED_SEGMENT_NAME_2)
    }
  })
})

tap.Test.prototype.addAssert('single', 2, function assertSpan(span, i) {
  this.ok(span)

  const { name } = span.intrinsics

  if (i === 0) {
    this.equal(name.string_value, EXPECTED_SEGMENT_NAME)
  } else {
    this.equal(name.string_value, EXPECTED_SEGMENT_NAME_2)
  }
})

const infiniteTracingService = grpc.loadPackageDefinition(packageDefinition).com.newrelic.trace.v1

// This runs through the same tests with the following 4 scenarios:
//  1. batching and compression
//  2. batching and no compression
//  3. no batching and compression
//  4. no batching and no compression
//
//  Depending on the mode it asserts the spans in 1 batch of in different stream.write
;[
  {
    batching: true,
    compression: false
  },
  {
    batching: true,
    compression: true
  },
  {
    batching: false,
    compression: true
  },
  {
    batching: false,
    compression: false
  }
].forEach((config) => {
  tap.test(`Infinite tracing - Batching Connection Handling ${JSON.stringify(config)}`, (t) => {
    t.autoend()

    let server = null
    let agent = null
    let startingEndpoints = null
    let spanReceivedListener = null

    t.beforeEach(async (t) => {
      await new Promise((resolve) => {
        testSetup(t, config, resolve)
      })
    })

    t.afterEach(async () => {
      helper.unloadAgent(agent)

      if (!nock.isDone()) {
        /* eslint-disable no-console */
        console.error('Cleaning pending mocks: %j', nock.pendingMocks())
        /* eslint-enable no-console */
        nock.cleanAll()
      }

      nock.enableNetConnect()

      await new Promise((resolve) => {
        server.tryShutdown(resolve)
      })
    })

    t.test('should successfully send span after startup', (t) => {
      t.context.config = config
      t.context.expectedRunId = INITIAL_RUN_ID
      t.context.expectedSessionId = INITIAL_SESSION_ID
      spanReceivedListener = defaultSpanListener(t)

      agent.start((error) => {
        verifyAgentStart(t, error, startingEndpoints)

        createTestData(agent, EXPECTED_SEGMENT_NAME)
        createTestData(agent, EXPECTED_SEGMENT_NAME_2)
      })
    })

    t.test(
      'should succeed, with updated run_id and request header metadata, after restart',
      (t) => {
        const RESTARTED_RUN_ID = 'restarted_run_id'
        const RESTARTED_SESSION_ID = 'restarted session id'

        let restartEndpoints = null

        // 409 response will trigger a restart
        const restartMetricEndpoint = nockRequest('metric_data', INITIAL_RUN_ID).reply(409)

        t.context.config = config
        t.context.expectedRunId = RESTARTED_RUN_ID
        t.context.expectedSessionId = RESTARTED_SESSION_ID
        spanReceivedListener = defaultSpanListener(t)

        agent.start((error) => {
          verifyAgentStart(t, error, startingEndpoints)

          agent.on('connecting', () => {
            t.equal(agent.spanEventAggregator.started, false)

            agent.spanEventAggregator.once('started', () => {
              // if new endpoints weren't hit, something else went wrong with test.
              verifyAgentStart(t, null, restartEndpoints)

              createTestData(agent, EXPECTED_SEGMENT_NAME)
              createTestData(agent, EXPECTED_SEGMENT_NAME_2)
            })
          })

          restartEndpoints = setupConnectionEndpoints(RESTARTED_RUN_ID, RESTARTED_SESSION_ID)

          // forces metric harvest which will result in restart
          agent.forceHarvestAll(() => {
            // if this wasn't hit, something else went wrong with the test
            t.ok(restartMetricEndpoint.isDone())
          })
        })
      }
    )

    t.test('should start immediately not wait for harvest when immediate harvest true', (t) => {
      agent.config.no_immediate_harvest = false

      let connectedCount = 0
      agent.spanEventAggregator.stream.connection.on('connected', () => {
        connectedCount++
      })

      let initialHarvestCalled = false

      const origForceHarvestAll = agent.forceHarvestAll
      agent.forceHarvestAll = function stubForceHarvestAll() {
        t.equal(connectedCount, 1, 'should have connected prior to initial harvest')
        initialHarvestCalled = true
        return origForceHarvestAll.apply(this, arguments)
      }

      agent.start((error) => {
        verifyAgentStart(t, error, startingEndpoints)

        // ensure test valid / hit the import assertion
        t.ok(initialHarvestCalled)

        t.end()
      })
    })

    function defaultSpanListener(t) {
      const { config, expectedRunId, expectedSessionId } = t.context

      let i = 0

      return function onSpans(data, metadata) {
        if (config.batching) {
          t.batch(data)
        } else {
          t.single(data, i)
          i++
        }

        const [licenseKey] = metadata.get('license_key')
        t.equal(licenseKey, EXPECTED_LICENSE_KEY, 'expected license key')

        const [runId] = metadata.get('agent_run_token')
        t.equal(runId, expectedRunId, 'agent_run_token matches')

        const [sessionId] = metadata.get('session_id')
        t.equal(sessionId, expectedSessionId, 'should persist new request_headers_map on metadata')

        if (config.batching || i === 1) {
          t.end()
        }
      }
    }

    function recordSpan(stream) {
      stream.on('data', function (span) {
        if (spanReceivedListener) {
          spanReceivedListener(span, stream.metadata)
        }
      })

      // this is necessary to properly end calls and cleanup
      stream.on('end', () => {
        stream.end()
      })
    }

    function recordSpanBatch(stream) {
      stream.on('data', function ({ spans }) {
        if (spanReceivedListener) {
          spanReceivedListener(spans, stream.metadata)
        }
      })

      // this is necessary to properly end calls and cleanup
      stream.on('end', () => {
        stream.end()
      })
    }
    function testSetup(t, config, callback) {
      nock.disableNetConnect()
      startingEndpoints = setupConnectionEndpoints(INITIAL_RUN_ID, INITIAL_SESSION_ID)

      helper
        .withSSL()
        .then(([key, certificate, ca]) => {
          const sslOpts = {
            ca,
            authPairs: [{ private_key: key, cert_chain: certificate }]
          }

          const services = [
            {
              serviceDefinition: infiniteTracingService.IngestService.service,
              implementation: { recordSpan, recordSpanBatch }
            }
          ]

          server = createGrpcServer(sslOpts, services, (err, port) => {
            t.error(err)

            server.start()

            agent = helper.loadMockedAgent({
              license_key: EXPECTED_LICENSE_KEY,
              apdex_t: Number.MIN_VALUE, // force transaction traces
              host: TEST_DOMAIN,
              plugins: {
                // turn off native metrics to avoid unwanted gc metrics
                native_metrics: { enabled: false }
              },
              distributed_tracing: { enabled: true },
              slow_sql: { enabled: true },
              transaction_tracer: {
                record_sql: 'obfuscated',
                explain_threshold: Number.MIN_VALUE // force SQL traces
              },
              infinite_tracing: {
                ...config,
                span_events: {
                  queue_size: 2
                },
                trace_observer: {
                  host: helper.SSL_HOST,
                  port
                }
              }
            })

            agent.config.no_immediate_harvest = true

            // Currently test-only configuration
            const origEnv = process.env.NEWRELIC_GRPCCONNECTION_CA
            process.env.NEWRELIC_GRPCCONNECTION_CA = ca
            t.teardown(() => {
              process.env.NEWRELIC_GRPCCONNECTION_CA = origEnv
            })

            if (callback) {
              callback()
            }
          })
        })
        .catch((err) => {
          t.error(err)
        })
    }
  })
})

function createTestData(agent, segmentName, callback) {
  helper.runInTransaction(agent, (transaction) => {
    const segment = transaction.trace.add(segmentName)
    segment.overwriteDurationInMillis(1)

    transaction.finalizeNameFromUri('/some/test/url', 200)
    transaction.end()

    if (callback) {
      callback()
    }
  })
}

function setupConnectionEndpoints(runId, sessionId) {
  return {
    preconnect: nockRequest('preconnect').reply(200, { return_value: TEST_DOMAIN }),
    connect: nockRequest('connect').reply(200, {
      return_value: {
        agent_run_id: runId,
        request_headers_map: {
          SESSION_ID: sessionId
        }
      }
    }),
    settings: nockRequest('agent_settings', runId).reply(200, { return_value: [] })
  }
}

function nockRequest(endpointMethod, runId) {
  const relativepath = helper.generateCollectorPath(endpointMethod, runId)
  return nock(TEST_COLLECTOR_URL).post(relativepath)
}

function verifyAgentStart(t, error, endpoints) {
  if (error) {
    throw error
  }

  t.ok(endpoints.preconnect.isDone(), 'requested preconnect')
  t.ok(endpoints.connect.isDone(), 'requested connect')
  t.ok(endpoints.settings.isDone(), 'requested settings')
}

/**
 * Creates a grpc server and returns once bound to a port.
 *
 * Does not start the server.
 *
 * @param {object} [sslOptions]
 * @param {Buffer | null} [sslOptions.ca]
 * @param {Array<{private_key: Buffer, cert_chain: Buffer}>} [sslOptions.authPairs]
 * @param {Array<{serviceDefinition: ServiceDefinition, implementation: object}>} services
 * @param {*} callback
 */
function createGrpcServer(sslOptions, services, callback) {
  const server = new grpc.Server()
  for (const [, service] of services.entries()) {
    server.addService(service.serviceDefinition, service.implementation)
  }

  const { ca, authPairs } = sslOptions
  const credentials = grpc.ServerCredentials.createSsl(ca, authPairs, false)

  // Select a random port
  server.bindAsync('localhost:0', credentials, (err, port) => {
    if (err) {
      callback(err)
    }

    callback(null, port)
  })

  return server
}
