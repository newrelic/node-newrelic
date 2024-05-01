/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const util = module.exports
const metricsHelpers = require('../../lib/metrics_helper')
const protoLoader = require('@grpc/proto-loader')
const serverImpl = require('./grpc-server.cjs')
const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const DESTINATION = DESTINATIONS.TRANS_EVENT | DESTINATIONS.ERROR_EVENT

const SERVER_ADDR = '0.0.0.0'
const CLIENT_ADDR = 'localhost'
const SERVER_TX_PREFIX = 'WebTransaction/WebFrameworkUri/gRPC/'
const { EXTERNAL } = require('../../../lib/metrics/names')

function buildMetrics(port) {
  const clientAddr = `${CLIENT_ADDR}:${port}`
  const rollupHost = `${EXTERNAL.PREFIX}${clientAddr}/all`
  const grpcMetricName = `${EXTERNAL.PREFIX}${clientAddr}/gRPC`
  return [grpcMetricName, rollupHost, EXTERNAL.WEB, EXTERNAL.ALL]
}

function buildExpectedMetrics(port) {
  const metrics = buildMetrics(port)
  return metrics.map((metric) => ({ name: metric }))
}

/**
 * Iterates over all metrics created during a transaction and asserts no gRPC metrics were created
 *
 * @param {Object} params
 * @param {Object} params.t tap test
 * @param {Object} params.agent test agent
 */
util.assertMetricsNotExisting = function assertMetricsNotExisting({ t, agent, port }) {
  const metrics = buildMetrics(port)
  metrics.forEach((metricName) => {
    const metric = agent.metrics.getMetric(metricName)
    t.notOk(metric, `${metricName} should not be recorded`)
  })
}

/**
 * Helper for loading our example protobuf API
 *
 * @param {Object} grpc @grpc/grpc-js pkg
 * @returns {Object} helloworld protobuf pkg
 */
function loadProtobufApi(grpc) {
  const PROTO_PATH = `${__dirname}/example.proto`
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  })
  return grpc.loadPackageDefinition(packageDefinition).helloworld
}

/**
 * Creates a gRPC server with the Greeter service and the server methods
 * from `./grpc-server`
 *
 * @param {Object} grpc grpc module
 * @returns {Object} { server, proto } grpc server and protobuf api
 */
util.createServer = async function createServer(grpc) {
  const server = new grpc.Server()
  const credentials = grpc.ServerCredentials.createInsecure()
  // quick and dirty map to store metadata for a given gRPC call
  server.metadataMap = new Map()
  const serverMethods = serverImpl(server)
  const proto = loadProtobufApi(grpc)
  server.addService(proto.Greeter.service, serverMethods)
  const port = await new Promise((resolve, reject) => {
    server.bindAsync(`${SERVER_ADDR}:0`, credentials, (err, port) => {
      if (err) {
        reject(err)
      } else {
        resolve(port)
      }
    })
  })
  server.start()
  return { server, proto, port }
}

/**
 * Gets the client for the Greeter service
 *
 * @param {Object} grpc grpc module
 * @param {Object} proto protobuf API example.proto
 * @returns {Object} client grpc client for Greeter service
 */
util.getClient = function getClient(grpc, proto, port) {
  const credentials = grpc.credentials.createInsecure()
  return new proto.Greeter(`${CLIENT_ADDR}:${port}`, credentials)
}

/**
 * Gets the formatted substring for a given gRPC method
 *
 * @param {string} fnName name of gRPC call
 * @returns {string}
 */
util.getRPCName = function getRPCName(fnName) {
  return `/helloworld.Greeter/${fnName}`
}

/**
 * Gets the formatted substring name for a given gRPC server call
 *
 * @param {string} fnName name of gRPC call
 * @returns {string}
 */
util.getServerTransactionName = function getRPCName(fnName) {
  return SERVER_TX_PREFIX + util.getRPCName(fnName)
}

/**
 * Asserts the gRPC external segment and its relevant attributes: url,
 * procedure, grpc.statusCode, grpc.statusText
 *
 * @param {Object} params
 * @param {Object} params.t tap test
 * @param {Object} params.tx transaction under test
 * @param {string} params.fnName gRPC method name
 * @param {number} [params.expectedStatusCode=0] expected status code for test
 * @param {string} [params.expectedStatusText=OK] expected status text for test
 */
util.assertExternalSegment = function assertExternalSegment({
  t,
  tx,
  fnName,
  expectedStatusCode = 0,
  expectedStatusText = 'OK',
  port
}) {
  const methodName = util.getRPCName(fnName)
  const segmentName = `${EXTERNAL.PREFIX}${CLIENT_ADDR}:${port}${methodName}`
  t.assertSegments(tx.trace.root, [segmentName], { exact: false })
  const segment = metricsHelpers.findSegment(tx.trace.root, segmentName)
  const attributes = segment.getAttributes()
  t.equal(
    attributes.url,
    `grpc://${CLIENT_ADDR}:${port}${methodName}`,
    'http.url attribute should be correct'
  )
  t.equal(attributes.procedure, methodName, 'method name should be correct')
  t.equal(
    attributes['grpc.statusCode'],
    expectedStatusCode,
    `status code should be ${expectedStatusCode}`
  )
  t.equal(
    attributes['grpc.statusText'],
    expectedStatusText,
    `status text should be ${expectedStatusText}`
  )
  t.equal(attributes.component, 'gRPC', 'should have the component set to "gRPC"')
  const expectedMetrics = buildExpectedMetrics(port)
  t.assertMetrics(tx.metrics, [expectedMetrics], false, false)
}

/**
 * Asserts the gRPC server segment and its relevant attributes: response.status
 * request.method, request.uri
 *
 * @param {Object} params
 * @param {Object} params.t tap test
 * @param {Object} params.tx transaction under test
 * @param {string} params.fnName gRPC method name
 * @param {number} [params.expectedStatusCode=0] expected status code for test
 */
util.assertServerTransaction = function assertServerTransaction({
  t,
  transaction,
  fnName,
  expectedStatusCode = 0
}) {
  const attributes = transaction.trace.attributes.get(DESTINATION)
  const expectedMethod = `/helloworld.Greeter/${fnName}`
  const expectedUri = `/helloworld.Greeter/${fnName}`
  t.equal(
    transaction.name,
    util.getServerTransactionName(fnName),
    'should have the right transaction name'
  )
  t.equal(
    attributes['response.status'],
    expectedStatusCode,
    `status code should be ${expectedStatusCode}`
  )
  t.equal(
    attributes['request.method'],
    expectedMethod,
    `should have server method ${expectedMethod}`
  )
  t.equal(attributes['request.uri'], expectedUri, `should have server uri ${expectedUri}`)
}

util.assertServerMetrics = function assertServerMetrics({ t, agentMetrics, fnName }) {
  const expectedServerMetrics = [
    [{ name: 'WebTransaction' }],
    [{ name: 'WebTransactionTotalTime' }],
    [{ name: 'HttpDispatcher' }],
    [{ name: `WebTransaction/WebFrameworkUri/gRPC//helloworld.Greeter/${fnName}` }],
    [{ name: `WebTransactionTotalTime/WebFrameworkUri/gRPC//helloworld.Greeter/${fnName}` }],
    [{ name: `Apdex/WebFrameworkUri/gRPC//helloworld.Greeter/${fnName}` }],
    [{ name: 'Apdex' }]
  ]
  t.assertMetrics(agentMetrics, expectedServerMetrics, false, false)
}

util.assertDistributedTracing = function assertDistributedTracing({
  t,
  clientTransaction,
  serverTransaction
}) {
  const serverAttributes = serverTransaction.trace.attributes.get(DESTINATION)
  t.ok(
    clientTransaction.id !== serverTransaction.id,
    'should get different transactions for client and server'
  )
  t.match(
    serverAttributes['request.headers.traceparent'],
    /^[\w\d\-]{55}$/,
    'should have traceparent in server attribute headers'
  )
  t.equal(serverAttributes['request.headers.newrelic'], '', 'should have the newrelic header')
  t.equal(
    clientTransaction.traceId,
    serverTransaction.traceId,
    'should have matching traceIds on client and server transactions'
  )
}

/**
 * Helper to make a unary client request
 *
 * @param {Object} params
 * @param {Object} params.client gRPC client
 * @param {string} params.fnName gRPC method name
 * @param {*} params.payload payload to gRPC method
 * @returns {Promise}
 */
util.makeUnaryRequest = function makeUnaryRequest({ client, fnName, payload }) {
  return new Promise((resolve, reject) => {
    client[fnName](payload, (err, response) => {
      if (err) {
        reject(err)
        return
      }
      resolve(response)
    })
  })
}

/**
 * Helper to make a streaming client request
 *
 * @param {Object} params
 * @param {Object} params.client gRPC client
 * @param {string} params.fnName gRPC method name
 * @param {*} params.payload payload to gRPC method
 * @returns {Promise}
 */
util.makeClientStreamingRequest = function makeClientStreamingRequest({
  client,
  fnName,
  payload,
  endStream = true
}) {
  return new Promise((resolve, reject) => {
    const call = client[fnName]((err, response) => {
      if (err) {
        reject(err)
        return
      }

      resolve(response)
    })

    payload.forEach((data) => call.write(data))

    if (endStream) {
      call.end()
    }
  })
}

/**
 * Helper to make a streaming server client request
 *
 * @param {Object} params
 * @param {Object} params.client gRPC client
 * @param {string} params.fnName gRPC method name
 * @param {*} params.payload payload to gRPC method
 * @returns {Promise}
 */
util.makeServerStreamingRequest = function makeServerStreamingRequest({ client, fnName, payload }) {
  return new Promise((resolve, reject) => {
    const serverData = []
    const call = client[fnName](payload)
    call.on('data', (response) => {
      serverData.push(response.message)
    })
    call.on('end', () => {
      resolve(serverData)
    })
    call.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Helper to make a bidirectional client request
 *
 * @param {Object} params
 * @param {Object} params.client gRPC client
 * @param {string} params.fnName gRPC method name
 * @param {*} params.payload payload to gRPC method
 * @returns {Promise}
 */
util.makeBidiStreamingRequest = function makeBidiStreamingRequest({ client, fnName, payload }) {
  return new Promise((resolve, reject) => {
    const serverData = []
    const call = client[fnName]()
    payload.forEach((data) => call.write(data))
    call.on('data', function (response) {
      serverData.push(response.message)
    })
    call.on('end', () => {
      resolve(serverData)
    })
    call.on('error', (err) => {
      reject(err)
    })
    call.end()
  })
}

/**
 * Helper to assert length of errors in trace aggregator
 * as well as proper code/text of error
 *
 * If the server use case it will also assert the transaction and metrics
 * If the client use case it will assert the external call segment
 *
 * @param {Object} params
 * @param {Object} params.t tap test
 * @param {Object} params.transaction transaction under test
 * @param {Array} params.errors agent errors array
 * @param {boolean} [params.expectErrors=true] flag to indicate if errors will exist
 * @param {boolean} [params.clientError=false] flag to indicate if error is client side
 * @param {Array} params.agentMetrics agent metrics array
 * @param {string} params.fnName gRPC method name
 * @param {number} params.expectedStatusCode expected status code for test
 * @param {string} params.expectedStatusText expected status text for test
 */
util.assertError = function assertError({
  t,
  transaction,
  errors,
  expectErrors = true,
  clientError = false,
  agentMetrics,
  fnName,
  expectedStatusText,
  expectedStatusCode,
  port
}) {
  // when testing client the transaction will contain both server and client information. so we need to extract the client error which is always the 2nd
  const errorLength = expectErrors ? (clientError ? 2 : 1) : 0

  t.equal(errors.traceAggregator.errors.length, errorLength, `should be ${errorLength} errors`)

  if (expectErrors) {
    const errorPosition = clientError ? 1 : 0
    const error = errors.traceAggregator.errors[errorPosition][2]
    t.equal(error, expectedStatusText, 'should have the error message')
  }

  if (clientError) {
    util.assertExternalSegment({
      t,
      tx: transaction,
      fnName,
      expectedStatusText,
      port,
      expectedStatusCode
    })
  } else {
    util.assertServerTransaction({
      t,
      transaction,
      fnName,
      expectedStatusCode
    })
    util.assertServerMetrics({
      t,
      agentMetrics,
      fnName,
      expectedStatusCode
    })
  }
}
