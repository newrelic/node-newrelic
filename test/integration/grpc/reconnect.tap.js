'use strict'
const tap = require('tap')

const safeRequire = (id) => {
  let tmp
  try {
    tmp = require(id)
  } catch (e) {
    return tmp
  }
  return tmp
}

const GrpcConnection = safeRequire('../../../lib/grpc/connection')
const grpc = safeRequire('../../../lib/proxy/grpc')

const protoLoader = require('@grpc/proto-loader')

const MetricAggregator = require('../../../lib/metrics/metric-aggregator')
const MetricMapper = require('../../../lib/metrics/mapper')
const MetricNormalizer = require('../../../lib/metrics/normalizer')

const setupServer = () => {
  var packageDefinition = protoLoader.loadSync(
    __dirname + '/../../../lib/grpc/endpoints/infinite-tracing/v1.proto',
    {keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    })
  var infiniteTracingService = grpc.loadPackageDefinition(packageDefinition).com.newrelic.trace.v1

  /**
   * Implements the recordSpan RPC method, used below
   */
  const recordSpan = (stream) => {
    // detach as soon as we connect

    // drain reads to make sure everything finishes properly
    stream.on('data', () => {})

    // end the stream -- sends back a STATUS OK
    stream.end()
  }

  var server = new grpc.Server()
  server.addService(
    infiniteTracingService.IngestService.service,
    {recordSpan: recordSpan}
  )
  server.bindAsync(
    '0.0.0.0:50051',
    grpc.ServerCredentials.createInsecure(),
    (err) => {
      if (err) {
        throw err
      }
      server.start()

      // setup a callback to disconnect the server
      // in 3 seconds if there's no more activity.
      setTimeout(()=>{
        server.tryShutdown(()=>{
        })
      }, 3000)
    }
  )
}

const createMetricAggregatorForTests = () => {
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

tap.test((t) => {
  if (GrpcConnection.message === '@grpc/grpc-js only works on Node ^8.13.0 || >=10.10.0') {
    t.end()
    return
  }
  // one assert for the initial connection
  // a second assert for the disconnect
  // a third assert for the reconnection
  // a fourth assert for the disconnect
  t.plan(4)

  // starts the server
  setupServer()
  const metrics = createMetricAggregatorForTests()

  // very short backoff to trigger the reconnect in 1 second
  const backoffs = [0, 1]
  const connection = new GrpcConnection(metrics, backoffs)

  let countDisconnects = 0

  // do a little monkey patching to get our non SSL/HTTP
  // credentials in there for this test.  This replaces
  // the _generateCredentials method on the GrpcConnection
  // object.  The .bind at the end isn't technically
  // necessary, but it ensures if we ever _did_ use the
  // this variable in out _generateCredentials that it
  // would be bound correctly.
  connection._generateCredentials = ((grpcApi) => {
    return grpcApi.credentials.createInsecure()
  }).bind(connection)

  const args = ['https://google.com', null, null]
  connection.setConnectionDetails(...args).connectSpans()
  connection.on('connected', (callStream) => {
    console.log('connected')
    t.equals(
      callStream.constructor.name,
      'ClientDuplexStreamImpl',
      'connected and received ClientDuplexStreamImpl'
    )
    callStream.end()
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
      return
    }
  })
})
