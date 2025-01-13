/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const nock = require('nock')
const { nockRequest } = require('./response-handling-utils')
const path = require('path')
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')

const fakeCert = require('../lib/fake-cert')
const helper = require('../lib/agent_helper')

// We generate the certificate once for the whole suite because it is a CPU
// intensive operation and would slow down tests if each test created its
// own certificate.
const cert = fakeCert({ commonName: 'localhost' })
const PROTO_PATH = path.join(__dirname, '../..', '/lib/grpc/endpoints/infinite-tracing/v1.proto')
const TEST_DOMAIN = 'test-collector.newrelic.com'
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

function assertBatch(spans) {
  assert.ok(spans.length === 2, 'should have 2 spans')

  spans.forEach((span, i) => {
    const { name } = span.intrinsics

    if (i === 0) {
      assert.equal(name.string_value, EXPECTED_SEGMENT_NAME)
    } else {
      assert.equal(name.string_value, EXPECTED_SEGMENT_NAME_2)
    }
  })
}

function assertSpan(span, i) {
  assert.ok(span)

  const { name } = span.intrinsics

  if (i === 0) {
    assert.equal(name.string_value, EXPECTED_SEGMENT_NAME)
  } else {
    assert.equal(name.string_value, EXPECTED_SEGMENT_NAME_2)
  }
}

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
  test(`Infinite tracing - Batching Connection Handling ${JSON.stringify(config)}`, async (t) => {
    t.beforeEach(async (ctx) => {
      ctx.nr = {}
      // Currently test-only configuration
      ctx.nr.origEnv = process.env.NEWRELIC_GRPCCONNECTION_CA
      process.env.NEWRELIC_GRPCCONNECTION_CA = cert.certificate
      await testSetup(ctx, config)
    })

    t.afterEach(async (ctx) => {
      const { agent, origEnv, server } = ctx.nr
      process.env.NEWRELIC_GRPCCONNECTION_CA = origEnv
      helper.unloadAgent(agent)

      if (!nock.isDone()) {
        console.error('Cleaning pending mocks: %j', nock.pendingMocks())
        nock.cleanAll()
      }

      nock.enableNetConnect()

      await new Promise((resolve) => {
        server.tryShutdown(resolve)
      })
    })

    await t.test('should successfully send span after startup', (t, end) => {
      const { agent, startingEndpoints } = t.nr
      const expectedRunId = INITIAL_RUN_ID
      const expectedSessionId = INITIAL_SESSION_ID
      t.nr.spanReceivedListener = defaultSpanListener({
        config,
        expectedRunId,
        expectedSessionId,
        end
      })

      agent.start((error) => {
        verifyAgentStart(error, startingEndpoints)

        createTestData(agent, EXPECTED_SEGMENT_NAME)
        createTestData(agent, EXPECTED_SEGMENT_NAME_2)
      })
    })

    await t.test(
      'should succeed, with updated run_id and request header metadata, after restart',
      (t, end) => {
        const { agent, startingEndpoints } = t.nr
        const RESTARTED_RUN_ID = 'restarted_run_id'
        const RESTARTED_SESSION_ID = 'restarted session id'

        // 409 response will trigger a restart
        const restartMetricEndpoint = nockRequest('metric_data', INITIAL_RUN_ID).reply(409)

        const expectedRunId = RESTARTED_RUN_ID
        const expectedSessionId = RESTARTED_SESSION_ID
        t.nr.spanReceivedListener = defaultSpanListener({
          config,
          expectedRunId,
          expectedSessionId,
          end
        })

        agent.start((error) => {
          verifyAgentStart(error, startingEndpoints)
          const restartEndpoints = setupConnectionEndpoints(RESTARTED_RUN_ID, RESTARTED_SESSION_ID)

          agent.on('connecting', () => {
            assert.equal(agent.spanEventAggregator.started, false)

            agent.spanEventAggregator.once('started', () => {
              // if new endpoints weren't hit, something else went wrong with test.
              verifyAgentStart(null, restartEndpoints)

              createTestData(agent, EXPECTED_SEGMENT_NAME)
              createTestData(agent, EXPECTED_SEGMENT_NAME_2)
            })
          })

          // forces metric harvest which will result in restart
          agent.forceHarvestAll(() => {
            // if this wasn't hit, something else went wrong with the test
            assert.ok(restartMetricEndpoint.isDone())
          })
        })
      }
    )

    await t.test(
      'should start immediately not wait for harvest when immediate harvest true',
      (t, end) => {
        const { agent, startingEndpoints } = t.nr
        agent.config.no_immediate_harvest = false

        let connectedCount = 0
        agent.spanEventAggregator.stream.connection.on('connected', () => {
          connectedCount++
        })

        let initialHarvestCalled = false

        const origForceHarvestAll = agent.forceHarvestAll
        agent.forceHarvestAll = function stubForceHarvestAll() {
          assert.equal(connectedCount, 1, 'should have connected prior to initial harvest')
          initialHarvestCalled = true
          return origForceHarvestAll.apply(this, arguments)
        }

        agent.start((error) => {
          verifyAgentStart(error, startingEndpoints)

          // ensure test valid / hit the import assertion
          assert.ok(initialHarvestCalled)

          end()
        })
      }
    )
  })
})

function defaultSpanListener({ config, expectedRunId, expectedSessionId, end }) {
  let i = 0

  return function onSpans(data, metadata) {
    if (config.batching) {
      assertBatch(data)
    } else {
      assertSpan(data, i)
      i++
    }

    const [licenseKey] = metadata.get('license_key')
    assert.equal(licenseKey, EXPECTED_LICENSE_KEY, 'expected license key')

    const [runId] = metadata.get('agent_run_token')
    assert.equal(runId, expectedRunId, 'agent_run_token matches')

    const [sessionId] = metadata.get('session_id')
    assert.equal(sessionId, expectedSessionId, 'should persist new request_headers_map on metadata')

    if (config.batching || i === 1) {
      end()
    }
  }
}

function recordSpan(ctx, stream) {
  const { spanReceivedListener } = ctx.nr
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

function recordSpanBatch(ctx, stream) {
  const { spanReceivedListener } = ctx.nr
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

async function testSetup(ctx, config) {
  nock.disableNetConnect()
  ctx.nr.startingEndpoints = setupConnectionEndpoints(INITIAL_RUN_ID, INITIAL_SESSION_ID)

  const sslOpts = {
    ca: cert.certificateBuffer,
    authPairs: [{ private_key: cert.privateKeyBuffer, cert_chain: cert.certificateBuffer }]
  }

  const services = [
    {
      serviceDefinition: infiniteTracingService.IngestService.service,
      implementation: {
        recordSpan: recordSpan.bind(null, ctx),
        recordSpanBatch: recordSpanBatch.bind(null, ctx)
      }
    }
  ]

  const { port, server } = await createGrpcServer(sslOpts, services)
  ctx.nr.agent = helper.loadMockedAgent({
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
    utilization: {
      detect_aws: false
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

  ctx.nr.agent.config.no_immediate_harvest = true
  ctx.nr.server = server
}

function createTestData(agent, segmentName) {
  helper.runInTransaction(agent, (transaction) => {
    const segment = transaction.trace.add(segmentName)
    segment.overwriteDurationInMillis(1)

    transaction.finalizeNameFromUri('/some/test/url', 200)
    transaction.end()
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

function verifyAgentStart(error, endpoints) {
  if (error) {
    throw error
  }

  assert.ok(endpoints.preconnect.isDone(), 'requested preconnect')
  assert.ok(endpoints.connect.isDone(), 'requested connect')
  assert.ok(endpoints.settings.isDone(), 'requested settings')
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
 */
async function createGrpcServer(sslOptions, services) {
  const server = new grpc.Server()
  for (const [, service] of services.entries()) {
    server.addService(service.serviceDefinition, service.implementation)
  }

  const { authPairs } = sslOptions
  const credentials = grpc.ServerCredentials.createSsl(null, authPairs, false)

  return new Promise((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', credentials, (err, port) => {
      if (err) {
        reject(err)
      }

      resolve({ port, server })
    })
  })
}
