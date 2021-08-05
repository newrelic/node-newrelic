/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')

const GrpcConnection = require('../../../lib/grpc/connection')
const grpc = require('../../../lib/proxy/grpc')

const protoLoader = require('@grpc/proto-loader')

const MetricAggregator = require('../../../lib/metrics/metric-aggregator')
const MetricMapper = require('../../../lib/metrics/mapper')
const MetricNormalizer = require('../../../lib/metrics/normalizer')
const StreamingSpanEvent = require('../../../lib/spans/streaming-span-event')

const helper = require('../../lib/agent_helper')

tap.test('test that connection class reconnects', async (t) => {
  // one assert for the initial connection
  // a second assert for the disconnect
  // a third assert for the reconnection
  // a fourth assert for the disconnect
  // a fifth assert for server connection count
  t.plan(5)

  let serverConnections = 0

  /**
   * Implements the recordSpan RPC method, used below.
   *
   * While the test functions correctly with a valid connection,
   * we ensure proper connection / OK status handling for this case.
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
  const port = await setupServer(t, sslOpts, recordSpan)

  // Currently test-only configuration
  const origEnv = process.env.NEWRELIC_GRPCCONNECTION_CA
  process.env.NEWRELIC_GRPCCONNECTION_CA = sslOpts.ca
  t.teardown(() => {
    process.env.NEWRELIC_GRPCCONNECTION_CA = origEnv
  })

  return new Promise((resolve) => {
    const metrics = createMetricAggregatorForTests()

    const traceObserverConfig = {
      host: helper.SSL_HOST,
      port: port
    }

    // very short backoff to trigger the reconnect in 1 second
    const backoffs = { initialSeconds: 0, seconds: 1 }
    const connection = new GrpcConnection(traceObserverConfig, metrics, backoffs)

    let countDisconnects = 0

    connection.on('connected', (callStream) => {
      t.equals(
        callStream.constructor.name,
        'ClientDuplexStreamImpl',
        'connected and received ClientDuplexStreamImpl'
      )
    })

    connection.on('disconnected', () => {
      countDisconnects++
      t.ok(true, 'disconnected')

      // if we've disconnected twice, the test is done
      // mark the state as permanantly closed in order to
      // avoid further automatic reconnects (skipping
      // _setState to avoid an additional disconnect event)
      if (countDisconnects > 1) {
        connection._state = 3 // replace with actual fake enum

        t.equals(serverConnections, 2)
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
tap.test('Should reconnect even when data sent back', async (t) => {
  // one assert for the initial connection
  // a second assert for the disconnect
  // a third assert for the reconnection
  // a fourth assert for the disconnect
  // a fifth assert for server connection count
  t.plan(5)

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
  const port = await setupServer(t, sslOpts, recordSpan)

  // Currently test-only configuration
  const origEnv = process.env.NEWRELIC_GRPCCONNECTION_CA
  process.env.NEWRELIC_GRPCCONNECTION_CA = sslOpts.ca
  t.teardown(() => {
    process.env.NEWRELIC_GRPCCONNECTION_CA = origEnv
  })

  return new Promise((resolve) => {
    const metrics = createMetricAggregatorForTests()

    const traceObserverConfig = {
      host: helper.SSL_HOST,
      port: port
    }

    // very short backoff to trigger the reconnect in 1 second
    const backoffs = { initialSeconds: 0, seconds: 1 }
    const connection = new GrpcConnection(traceObserverConfig, metrics, backoffs)

    let countDisconnects = 0

    connection.on('connected', (callStream) => {
      t.equals(
        callStream.constructor.name,
        'ClientDuplexStreamImpl',
        'connected and received ClientDuplexStreamImpl'
      )

      callStream.write(new StreamingSpanEvent())
    })

    connection.on('disconnected', () => {
      countDisconnects++
      t.ok(true, 'disconnected')

      // if we've disconnected twice, the test is done
      // mark the state as permanantly closed in order to
      // avoid further automatic reconnects (skipping
      // _setState to avoid an additional disconnect event)
      if (countDisconnects > 1) {
        connection._state = 3 // replace with actual fake enum

        t.equals(serverConnections, 2)
        // Ends the test
        resolve()
      }
    })

    connection.setConnectionDetails().connectSpans()
  })
})

async function setupSsl() {
  const [key, certificate, ca] = await helper.withSSL()
  return {
    ca,
    authPairs: [
      {
        private_key: key,
        cert_chain: certificate
      }
    ]
  }
}

function setupServer(t, sslOpts, recordSpan) {
  const packageDefinition = protoLoader.loadSync(
    __dirname + '/../../../lib/grpc/endpoints/infinite-tracing/v1.proto',
    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
  )
  const infiniteTracingService = grpc.loadPackageDefinition(packageDefinition).com.newrelic.trace.v1

  const server = new grpc.Server()
  server.addService(infiniteTracingService.IngestService.service, { recordSpan: recordSpan })

  const { ca, authPairs } = sslOpts

  return new Promise((resolve, reject) => {
    server.bindAsync(
      'localhost:0',
      grpc.ServerCredentials.createSsl(ca, authPairs, false),
      (err, port) => {
        if (err) {
          reject(err)
        }
        server.start()
        resolve(port)
        // shutdown server when tests finish
        t.teardown(() => {
          server.tryShutdown(() => {})
        })
      }
    )
  })
}

function createMetricAggregatorForTests() {
  const mapper = new MetricMapper()
  const normalizer = new MetricNormalizer({}, 'metric name')

  const metrics = new MetricAggregator(
    {
      apdexT: 0.5,
      mapper: mapper,
      normalizer: normalizer
    },
    {}
  )
  return metrics
}
