/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('node:path')

const util = module.exports
const metricsHelpers = require('../../lib/metrics_helper')
const protoLoader = require('@grpc/proto-loader')
const serverImpl = require('./grpc-server.cjs')
const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const DESTINATION = DESTINATIONS.TRANS_EVENT | DESTINATIONS.ERROR_EVENT

const { assertMetrics, assertSegments, assertSpanKind, match } = require('../../lib/custom-assertions')

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
  return metrics.map((metric) => { return { name: metric } })
}

function assertContext({ agent, name, assert = require('node:assert') }) {
  // convert first letter to upper case to match function name
  name = name.replace(/\w+/g, (word) => word[0].toUpperCase() + word.slice(1))
  const ctx = agent.tracer.getContext()
  assert.ok(ctx.transaction)
  assert.ok(ctx.segment)
  assert.equal(ctx.transaction.isActive(), true)
  assert.ok(ctx.segment.name.startsWith('External/'))
  assert.ok(ctx.segment.name.endsWith(`helloworld.Greeter/${name}`))
}

/**
 * Iterates over all metrics created during a transaction and asserts no gRPC metrics were created
 *
 * @param {object} params params object
 * @param {object} params.agent test agent
 * @param {number} params.port port
 * @param {object} [deps] optional dependencies
 * @param {object} [deps.assert] the assert library to use
 */
util.assertMetricsNotExisting = function assertMetricsNotExisting(
  { agent, port },
  { assert = require('node:assert') } = {}
) {
  const metrics = buildMetrics(port)
  metrics.forEach((metricName) => {
    const metric = agent.metrics.getMetric(metricName)
    assert.equal(metric, undefined, `${metricName} should not be recorded`)
  })
}

/**
 * Helper for loading our example protobuf API
 *
 * @param {object} grpc @grpc/grpc-js pkg
 * @returns {object} helloworld protobuf pkg
 */
function loadProtobufApi(grpc) {
  const PROTO_PATH = path.join(__dirname, 'example.proto')
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
 * @param {object} grpc grpc module
 * @param {Agent} [agent] if specified will assert the context in handlers
 * @returns {object} { server, proto } grpc server and protobuf api
 */
util.createServer = async function createServer(grpc, agent) {
  const server = new grpc.Server()
  const credentials = grpc.ServerCredentials.createInsecure()
  // quick and dirty map to store metadata for a given gRPC call
  server.metadataMap = new Map()
  const serverMethods = serverImpl(server, agent)
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
  // TODO: no longer need in 1.10.0+, we test on 1.4.0+ atm
  server.start()
  return { server, proto, port }
}

/**
 * Gets the client for the Greeter service
 *
 * @param {object} grpc grpc module
 * @param {object} proto protobuf API example.proto
 * @param {number} port client port
 * @returns {object} client grpc client for Greeter service
 */
util.getClient = function getClient(grpc, proto, port) {
  const credentials = grpc.credentials.createInsecure()
  return new proto.Greeter(`${CLIENT_ADDR}:${port}`, credentials)
}

/**
 * Gets the formatted substring for a given gRPC method
 *
 * @param {string} fnName name of gRPC call
 * @returns {string} RPC name
 */
util.getRPCName = function getRPCName(fnName) {
  return `/helloworld.Greeter/${fnName}`
}

/**
 * Gets the formatted substring name for a given gRPC server call
 *
 * @param {string} fnName name of gRPC call
 * @returns {string} transaction string
 */
util.getServerTransactionName = function getServerTransactionName(fnName) {
  return SERVER_TX_PREFIX + util.getRPCName(fnName)
}

/**
 * Asserts the gRPC external segment and its relevant attributes: url,
 * procedure, grpc.statusCode, grpc.statusText
 *
 * @param {object} params params object
 * @param {object} params.tx transaction under test
 * @param {string} params.fnName gRPC method name
 * @param {number} [params.expectedStatusCode] expected status code for test
 * @param {string} [params.expectedStatusText] expected status text for test
 * @param {number} params.port port
 * @param {object} [deps] optional dependencies
 * @param {object} [deps.assert] the assert library to use
 */
util.assertExternalSegment = function assertExternalSegment(
  { tx, fnName, expectedStatusCode = 0, expectedStatusText = 'OK', port },
  { assert = require('node:assert') } = {}
) {
  const methodName = util.getRPCName(fnName)
  const segmentName = `${EXTERNAL.PREFIX}${CLIENT_ADDR}:${port}${methodName}`
  assertSegments(tx.trace, tx.trace.root, [segmentName], { exact: false }, { assert })
  assertSpanKind({ agent: tx.agent, segments: [{ name: segmentName, kind: 'client' }], assert })
  const segment = metricsHelpers.findSegment(tx.trace, tx.trace.root, segmentName)
  const attributes = segment.getAttributes()
  assert.equal(
    attributes.url,
    `grpc://${CLIENT_ADDR}:${port}${methodName}`,
    'http.url attribute should be correct'
  )
  assert.equal(attributes.procedure, methodName, 'method name should be correct')
  assert.equal(
    attributes['grpc.statusCode'],
    expectedStatusCode,
    `status code should be ${expectedStatusCode}`
  )
  assert.equal(
    attributes['grpc.statusText'],
    expectedStatusText,
    `status text should be ${expectedStatusText}`
  )
  assert.equal(attributes.component, 'gRPC', 'should have the component set to "gRPC"')
  const expectedMetrics = buildExpectedMetrics(port)
  assertMetrics(tx.metrics, [expectedMetrics], false, false, { assert })
}

/**
 * Asserts the gRPC server segment and its relevant attributes: response.status
 * request.method, request.uri
 *
 * @param {object} params params object
 * @param {object} params.transaction transaction under test
 * @param {string} params.fnName gRPC method name
 * @param {number} [params.expectedStatusCode] expected status code for test
 * @param {object} [deps] optional dependencies
 * @param {object} [deps.assert] the assert library to use
 */
util.assertServerTransaction = function assertServerTransaction(
  { transaction, fnName, expectedStatusCode = 0 },
  { assert = require('node:assert') } = {}
) {
  const attributes = transaction.trace.attributes.get(DESTINATION)
  const expectedMethod = `/helloworld.Greeter/${fnName}`
  const expectedUri = `/helloworld.Greeter/${fnName}`
  assert.equal(
    transaction.name,
    util.getServerTransactionName(fnName),
    'should have the right transaction name'
  )
  assert.equal(
    attributes['response.status'],
    expectedStatusCode,
    `status code should be ${expectedStatusCode}`
  )
  assert.equal(
    attributes['request.method'],
    expectedMethod,
    `should have server method ${expectedMethod}`
  )
  assert.equal(attributes['request.uri'], expectedUri, `should have server uri ${expectedUri}`)
  assertSpanKind({ agent: transaction.agent, segments: [{ name: transaction.name, kind: 'server' }], assert })
}

util.assertServerMetrics = function assertServerMetrics(
  { agentMetrics, fnName },
  { assert = require('node:assert') } = {}
) {
  const expectedServerMetrics = [
    [{ name: 'WebTransaction' }],
    [{ name: 'WebTransactionTotalTime' }],
    [{ name: 'HttpDispatcher' }],
    [{ name: `WebTransaction/WebFrameworkUri/gRPC//helloworld.Greeter/${fnName}` }],
    [{ name: `WebTransactionTotalTime/WebFrameworkUri/gRPC//helloworld.Greeter/${fnName}` }],
    [{ name: `Apdex/WebFrameworkUri/gRPC//helloworld.Greeter/${fnName}` }],
    [{ name: 'Apdex' }]
  ]
  assertMetrics(agentMetrics, expectedServerMetrics, false, false, { assert })
}

util.assertDistributedTracing = function assertDistributedTracing(
  { clientTransaction, serverTransaction },
  { assert = require('node:assert') } = {}
) {
  const serverAttributes = serverTransaction.trace.attributes.get(DESTINATION)
  assert.ok(
    clientTransaction.id !== serverTransaction.id,
    'should get different transactions for client and server'
  )
  match(serverAttributes['request.headers.traceparent'], /^[\w-]{55}$/, { assert })
  assert.equal(
    clientTransaction.traceId,
    serverTransaction.traceId,
    'should have matching traceIds on client and server transactions'
  )
}

/**
 * Helper to make a unary client request
 *
 * @param {object} params params object
 * @param {object} params.client gRPC client
 * @param {string} params.fnName gRPC method name
 * @param {Agent} [params.agent] agent instance that if present will assert context
 * @param {*} params.payload payload to gRPC method
 * @returns {Promise} promise
 */
util.makeUnaryRequest = function makeUnaryRequest({ client, fnName, payload, agent }) {
  return new Promise((resolve, reject) => {
    client[fnName](payload, (err, response) => {
      if (agent) {
        assertContext({ agent, name: fnName })
      }
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
 * @param {object} params params object
 * @param {object} params.client gRPC client
 * @param {string} params.fnName gRPC method name
 * @param {*} params.payload payload to gRPC method
 * @param {boolean} [params.endStream] defaults to true
 * @param {Agent} [params.agent] agent instance that if present will assert context
 * @returns {Promise} promise
 */
util.makeClientStreamingRequest = function makeClientStreamingRequest({
  agent,
  client,
  fnName,
  payload,
  endStream = true
}) {
  return new Promise((resolve, reject) => {
    const call = client[fnName]((err, response) => {
      if (agent) {
        assertContext({ agent, name: fnName })
      }
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
 * @param {object} params params object
 * @param {object} params.client gRPC client
 * @param {string} params.fnName gRPC method name
 * @param {*} params.payload payload to gRPC method
 * @param {Agent} [params.agent] agent instance that if present will assert context
 * @returns {Promise} promise
 */
util.makeServerStreamingRequest = function makeServerStreamingRequest({ client, fnName, payload, agent }) {
  return new Promise((resolve, reject) => {
    const serverData = []
    const call = client[fnName](payload)
    call.on('data', (response) => {
      if (agent) {
        assertContext({ agent, name: fnName })
      }
      serverData.push(response.message)
    })
    call.on('end', () => {
      if (agent) {
        assertContext({ agent, name: fnName })
      }
      resolve(serverData)
    })
    call.on('error', (err) => {
      if (agent) {
        assertContext({ agent, name: fnName })
      }
      reject(err)
    })
  })
}

/**
 * Helper to make a bidirectional client request
 *
 * @param {object} params params object
 * @param {object} params.client gRPC client
 * @param {string} params.fnName gRPC method name
 * @param {*} params.payload payload to gRPC method
 * @param {Agent} [params.agent] agent instance that if present will assert context
 * @returns {Promise} promise
 */
util.makeBidiStreamingRequest = function makeBidiStreamingRequest({ agent, client, fnName, payload }) {
  return new Promise((resolve, reject) => {
    const serverData = []
    const call = client[fnName]()
    payload.forEach((data) => call.write(data))
    call.on('data', function (response) {
      if (agent) {
        assertContext({ agent, name: fnName })
      }
      serverData.push(response.message)
    })
    call.on('end', () => {
      if (agent) {
        assertContext({ agent, name: fnName })
      }
      resolve(serverData)
    })
    call.on('error', (err) => {
      if (agent) {
        assertContext({ agent, name: fnName })
      }
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
 * @param {object} params params object
 * @param {object} params.transaction transaction under test
 * @param {Array} params.errors agent errors array
 * @param {boolean} [params.expectErrors] flag to indicate if errors will exist
 * @param {boolean} [params.clientError] flag to indicate if error is client side
 * @param {Array} params.agentMetrics agent metrics array
 * @param {string} params.fnName gRPC method name
 * @param {number} params.expectedStatusCode expected status code for test
 * @param {string} params.expectedStatusText expected status text for test
 * @param {number} params.port port
 * @param {object} [deps] optional dependencies
 * @param {object} [deps.assert] the assert library to use
 */
util.assertError = function assertError(
  {
    transaction,
    errors,
    expectErrors = true,
    clientError = false,
    agentMetrics,
    fnName,
    expectedStatusText,
    expectedStatusCode,
    port
  },
  { assert = require('node:assert') } = {}
) {
  // when testing client the transaction will contain both server and client
  // information. so we need to extract the client error which is always the 2nd
  let errorLength = 0
  if (expectErrors) {
    if (clientError) {
      errorLength = 2
    } else {
      errorLength = 1
    }
  }

  assert.equal(errors.traceAggregator.errors.length, errorLength, `should be ${errorLength} errors`)

  if (expectErrors) {
    const errorPosition = clientError ? 1 : 0
    const error = errors.traceAggregator.errors[errorPosition][2]
    assert.equal(error, expectedStatusText, 'should have the error message')
  }

  if (clientError) {
    util.assertExternalSegment(
      {
        tx: transaction,
        fnName,
        expectedStatusText,
        port,
        expectedStatusCode
      },
      { assert }
    )
  } else {
    util.assertServerTransaction(
      {
        transaction,
        fnName,
        expectedStatusCode
      },
      { assert }
    )
    util.assertServerMetrics(
      {
        agentMetrics,
        fnName,
        expectedStatusCode
      },
      { assert }
    )
  }
}
