/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const nock = require('nock')
const { nockRequest } = require('./response-handling-utils')
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const { tspl } = require('@matteo.collina/tspl')
const { INFINITE_TRACING } = require('#agentlib/metrics/names.js')

const fakeCert = require('../lib/fake-cert')
const helper = require('../lib/agent_helper')

// We generate the certificate once for the whole suite because it is a CPU
// intensive operation and would slow down tests if each test created its
// own certificate.
const cert = fakeCert({ commonName: 'localhost' })
const PROTO = require('../../lib/grpc/endpoints/infinite-tracing/v1.json')
const TEST_DOMAIN = 'test-collector.newrelic.com'
// This key is hardcoded in the agent helper
const EXPECTED_LICENSE_KEY = 'license key here'
const INITIAL_RUN_ID = 'initial_run_id'
const INITIAL_SESSION_ID = 'initial_session_id'

const packageDefinition = protoLoader.fromJSON(PROTO, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
})

function assertBatch({ spans, names, plan }) {
  spans.forEach((span, i) => {
    const { name } = span.intrinsics
    plan.equal(name.string_value, names[i])
  })
}

function assertSpan({ span, i, names, plan }) {
  const { name } = span.intrinsics

  plan.equal(name.string_value, names[i])
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

    await t.test('should successfully send span after startup', async (t) => {
      const plan = tspl(t, { plan: 11 })
      const { agent, startingEndpoints } = t.nr
      const expectedRunId = INITIAL_RUN_ID
      const expectedSessionId = INITIAL_SESSION_ID
      const names = ['segment1', 'segment2']
      t.nr.spanReceivedListener = defaultSpanListener({
        agent,
        calls: [
          {
            seen: 2,
            sent: 2,
            dropped: 0,
            names
          }
        ],
        config,
        expectedRunId,
        expectedSessionId,
        plan
      })

      agent.start((error) => {
        verifyAgentStart({ error, endpoints: startingEndpoints, plan })

        createTestData({ agent, names })
      })

      await plan.completed
    })

    await t.test(
      'should succeed, with updated run_id and request header metadata, after restart',
      async (t) => {
        const plan = tspl(t, { plan: 16 })
        const { agent, startingEndpoints } = t.nr
        const RESTARTED_RUN_ID = 'restarted_run_id'
        const RESTARTED_SESSION_ID = 'restarted session id'

        // 409 response will trigger a restart
        const restartMetricEndpoint = nockRequest('metric_data', INITIAL_RUN_ID).reply(409)

        const expectedRunId = RESTARTED_RUN_ID
        const expectedSessionId = RESTARTED_SESSION_ID
        const names = ['segment1', 'segment2']
        t.nr.spanReceivedListener = defaultSpanListener({
          agent,
          calls: [
            {
              seen: 2,
              sent: 2,
              dropped: 0,
              names
            }
          ],
          config,
          expectedRunId,
          expectedSessionId,
          plan
        })

        agent.start((error) => {
          verifyAgentStart({ error, endpoints: startingEndpoints, plan })
          const restartEndpoints = setupConnectionEndpoints(RESTARTED_RUN_ID, RESTARTED_SESSION_ID)

          agent.on('connecting', () => {
            plan.equal(agent.spanEventAggregator.started, false)

            agent.spanEventAggregator.once('started', () => {
              // if new endpoints weren't hit, something else went wrong with test.
              verifyAgentStart({ endpoints: restartEndpoints, plan })

              createTestData({ agent, names })
            })
          })

          // forces metric harvest which will result in restart
          agent.forceHarvestAll(() => {
            // if this wasn't hit, something else went wrong with the test
            plan.ok(restartMetricEndpoint.isDone())
          })
        })

        await plan.completed
      }
    )

    await t.test(
      'should start immediately not wait for harvest when immediate harvest true',
      async (t) => {
        const plan = tspl(t, { plan: 5 })
        const { agent, startingEndpoints } = t.nr
        agent.config.no_immediate_harvest = false

        let connectedCount = 0
        agent.spanEventAggregator.stream.connection.on('connected', () => {
          connectedCount++
        })

        let initialHarvestCalled = false

        const origForceHarvestAll = agent.forceHarvestAll
        agent.forceHarvestAll = function stubForceHarvestAll() {
          plan.equal(connectedCount, 1, 'should have connected prior to initial harvest')
          initialHarvestCalled = true
          return origForceHarvestAll.apply(this, arguments)
        }

        agent.start((error) => {
          verifyAgentStart({ error, endpoints: startingEndpoints, plan })

          // ensure test valid / hit the import assertion
          plan.ok(initialHarvestCalled)
        })

        await plan.completed
      }
    )
  })

  test('should retry a failed batch', async (t) => {
    const plan = tspl(t, { plan: 11 })
    t.nr = { error: true }
    // Currently test-only configuration
    t.nr.origEnv = process.env.NEWRELIC_GRPCCONNECTION_CA
    process.env.NEWRELIC_GRPCCONNECTION_CA = cert.certificate
    await testSetup(t, config)
    const { agent, startingEndpoints } = t.nr

    t.after(async (ctx) => {
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

    const expectedRunId = INITIAL_RUN_ID
    const expectedSessionId = INITIAL_SESSION_ID
    const names = ['segment1', 'segment2']
    t.nr.spanReceivedListener = defaultSpanListener({
      agent,
      calls: [
        {
          seen: 2,
          sent: 2,
          dropped: 0,
          names
        }
      ],
      config,
      expectedRunId,
      expectedSessionId,
      plan
    })

    agent.start((error) => {
      verifyAgentStart({ error, endpoints: startingEndpoints, plan })

      createTestData({ agent, names })
    })

    await plan.completed
  })
})

function defaultSpanListener({ agent, calls, config, expectedRunId, expectedSessionId, plan }) {
  let req = 0
  let spans = 0

  return function onSpans(data, metadata) {
    const call = calls[req]
    const { names, seen, sent, dropped } = call
    if (config.batching) {
      assertBatch({ spans: data, names, plan })
      req++
    } else {
      assertSpan({ span: data, i: spans, names, plan })
      spans++
    }

    if (config.batching || spans === names.length) {
      const [licenseKey] = metadata.get('license_key')
      plan.equal(licenseKey, EXPECTED_LICENSE_KEY, 'expected license key')

      const [runId] = metadata.get('agent_run_token')
      plan.equal(runId, expectedRunId, 'agent_run_token matches')

      const [sessionId] = metadata.get('session_id')
      plan.equal(sessionId, expectedSessionId, 'should persist new request_headers_map on metadata')
      const actualSeen = agent.metrics.getOrCreateMetric(INFINITE_TRACING.SEEN).callCount
      const actualSent = agent.metrics.getOrCreateMetric(INFINITE_TRACING.SENT).callCount
      const actualDropped = agent.metrics.getOrCreateMetric(INFINITE_TRACING.DROPPED).callCount
      plan.equal(actualSeen, seen, `should have seen ${seen}, spans`)
      plan.equal(actualSent, sent, `should have sent ${sent} spans`)
      plan.equal(actualDropped, dropped, `should have dropped ${dropped} spans`)
    }
  }
}

function recordSpan(ctx, stream) {
  const { error, spanReceivedListener } = ctx.nr
  stream.on('data', function (span) {
    if (error && !ctx.nr.errored) {
      stream.emit('error', { code: 14, message: 'transient failure' })
      ctx.nr.errored = true
      return
    }
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
  const { error, spanReceivedListener } = ctx.nr
  stream.on('data', function ({ spans }) {
    if (error && !ctx.nr.errored) {
      stream.emit('error', { code: 14, message: 'transient failure' })
      ctx.nr.errored = true
      return
    }
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
        queue_size: 2,
        batch_size: 2
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

function createTestData({ agent, names }) {
  helper.runInTransaction(agent, (transaction) => {
    names.forEach((name) => {
      const segment = transaction.trace.add(name)
      segment.overwriteDurationInMillis(1)
    })

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

function verifyAgentStart({ error, endpoints, plan }) {
  if (error) {
    throw error
  }

  plan.ok(endpoints.preconnect.isDone(), 'requested preconnect')
  plan.ok(endpoints.connect.isDone(), 'requested connect')
  plan.ok(endpoints.settings.isDone(), 'requested settings')
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
