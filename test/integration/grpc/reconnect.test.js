/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const path = require('node:path')
const tspl = require('@matteo.collina/tspl')

const GrpcConnection = require('../../../lib/grpc/connection')
const grpc = require('../../../lib/proxy/grpc')

const protoLoader = require('@grpc/proto-loader')

const MetricAggregator = require('../../../lib/metrics/metric-aggregator')
const MetricMapper = require('../../../lib/metrics/mapper')
const MetricNormalizer = require('../../../lib/metrics/normalizer')
const StreamingSpanEvent = require('../../../lib/spans/streaming-span-event')

const fakeCert = require('../../lib/fake-cert')
const helper = require('../../lib/agent_helper')

// We generate the certificate once for the whole suite because it is a CPU
// intensive operation and would slow down tests if each test created its
// own certificate.
const cert = fakeCert({ commonName: 'localhost' })

test('test that connection class reconnects', async (t) => {
  // one assert for the initial connection
  // a second assert for the disconnect
  // a third assert for the reconnection
  // a fourth assert for the disconnect
  // a fifth assert for server connection count
  const plan = tspl(t, { plan: 5 })

  let serverConnections = 0

  /**
   * Implements the recordSpan RPC method, used below.
   *
   * While the test functions correctly with a valid connection,
   * we ensure proper connection / OK status handling for this case.
   * @param {object} stream The stream to record.
   */
  const recordSpan = (stream) => {
    serverConnections++

    // drain reads to make sure everything finishes properly
    stream.on('data', () => {})

    // detach as soon as we connect
    // end the stream -- sends back a STATUS OK
    stream.end()
  }

  const sslOpts = await setupSsl()
  const { port, server } = await setupServer(t, sslOpts, recordSpan)

  // Currently test-only configuration
  const origEnv = process.env.NEWRELIC_GRPCCONNECTION_CA
  process.env.NEWRELIC_GRPCCONNECTION_CA = cert.certificate
  t.after(() => {
    process.env.NEWRELIC_GRPCCONNECTION_CA = origEnv
    server.tryShutdown(() => {})
  })

  return new Promise((resolve) => {
    const metrics = createMetricAggregatorForTests()

    const traceObserverConfig = {
      trace_observer: {
        host: helper.SSL_HOST,
        port
      }
    }

    // very short backoff to trigger the reconnect in 1 second
    const backoffs = { initialSeconds: 0, seconds: 1 }
    const connection = new GrpcConnection(traceObserverConfig, metrics, backoffs)

    let countDisconnects = 0

    connection.on('connected', (callStream) => {
      plan.equal(
        callStream.constructor.name,
        'ClientDuplexStreamImpl',
        'connected and received ClientDuplexStreamImpl'
      )
    })

    connection.on('disconnected', () => {
      countDisconnects++
      plan.ok(true, 'disconnected')

      // if we've disconnected twice, the test is done
      // mark the state as permanently closed in order to
      // avoid further automatic reconnects (skipping
      // _setState to avoid an additional disconnect event)
      if (countDisconnects > 1) {
        connection._state = 3 // replace with actual fake enum

        plan.equal(serverConnections, 2)
        // Ends the test
        resolve()
      }
    })

    connection.setConnectionDetails().connectSpans()
  })
})

/**
 * With Node streams, when the server sends back data and we are not subscribed to the
 * data event, the status event never fires thus preventing reconnects. This results in
 * us being pinned to a bad stream and throwing 'ERR_STREAM_WRITE_AFTER_END' errors.
 */
test('Should reconnect even when data sent back', async (t) => {
  // one assert for the initial connection
  // a second assert for the disconnect
  // a third assert for the reconnection
  // a fourth assert for the disconnect
  // a fifth assert for server connection count
  const plan = tspl(t, { plan: 5 })

  let serverConnections = 0

  const recordSpan = (stream) => {
    serverConnections++

    // drain reads to make sure everything finishes properly
    stream.on('data', () => {
      // Writing data critical for triggering bug.
      stream.write({ messages_seen: 1 })

      // end the stream -- sends back a STATUS OK
      stream.end()
    })
  }

  const sslOpts = await setupSsl()
  const { port, server } = await setupServer(t, sslOpts, recordSpan)

  // Currently test-only configuration
  const origEnv = process.env.NEWRELIC_GRPCCONNECTION_CA
  process.env.NEWRELIC_GRPCCONNECTION_CA = cert.certificate
  t.after(() => {
    process.env.NEWRELIC_GRPCCONNECTION_CA = origEnv
    server.tryShutdown(() => {})
  })

  return new Promise((resolve) => {
    const metrics = createMetricAggregatorForTests()

    const traceObserverConfig = {
      trace_observer: {
        host: helper.SSL_HOST,
        port
      }
    }

    // very short backoff to trigger the reconnect in 1 second
    const backoffs = { initialSeconds: 0, seconds: 1 }
    const connection = new GrpcConnection(traceObserverConfig, metrics, backoffs)

    let countDisconnects = 0

    connection.on('connected', (callStream) => {
      plan.equal(
        callStream.constructor.name,
        'ClientDuplexStreamImpl',
        'connected and received ClientDuplexStreamImpl'
      )

      callStream.write(new StreamingSpanEvent())
    })

    connection.on('disconnected', () => {
      countDisconnects++
      plan.ok(true, 'disconnected')

      // if we've disconnected twice, the test is done
      // mark the state as permanently closed in order to
      // avoid further automatic reconnects (skipping
      // _setState to avoid an additional disconnect event)
      if (countDisconnects > 1) {
        connection._state = 3 // replace with actual fake enum

        plan.equal(serverConnections, 2)
        // Ends the test
        resolve()
      }
    })

    connection.setConnectionDetails().connectSpans()
  })
})

async function setupSsl() {
  return {
    ca: null,
    authPairs: [
      {
        private_key: cert.privateKeyBuffer,
        cert_chain: cert.certificateBuffer
      }
    ]
  }
}

function setupServer(t, sslOpts, recordSpan) {
  const packageDefinition = protoLoader.loadSync(
    path.join(__dirname, '/../../../lib/grpc/endpoints/infinite-tracing/v1.proto'),
    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
  )
  const infiniteTracingService = grpc.loadPackageDefinition(packageDefinition).com.newrelic.trace.v1

  const server = new grpc.Server()
  server.addService(infiniteTracingService.IngestService.service, { recordSpan })

  const { ca, authPairs } = sslOpts

  return new Promise((resolve, reject) => {
    server.bindAsync(
      'localhost:0',
      grpc.ServerCredentials.createSsl(ca, authPairs, false),
      (err, port) => {
        if (err) {
          reject(err)
        }
        resolve({ port, server })
      }
    )
  })
}

function createMetricAggregatorForTests() {
  const mapper = new MetricMapper()
  const normalizer = new MetricNormalizer({}, 'metric name')

  return new MetricAggregator(
    {
      apdexT: 0.5,
      mapper,
      normalizer
    },
    {},
    { add() {} }
  )
}
