/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const util = module.exports
const metricsHelpers = require('../../lib/metrics_helper')
const protoLoader = require('@grpc/proto-loader')

const SERVER_ADDR = '0.0.0.0:50051'
const CLIENT_ADDR = 'localhost:50051'
const { EXTERNAL } = require('../../../lib/metrics/names')
const rollupHost = `${EXTERNAL.PREFIX}${CLIENT_ADDR}/all`
const grpcMetricName = `${EXTERNAL.PREFIX}${CLIENT_ADDR}/gRPC`
const metrics = [grpcMetricName, rollupHost, EXTERNAL.WEB, EXTERNAL.ALL]
const expectedMetrics = metrics.map((metric) => ({ name: metric }))

/**
 * Iterates over all metrics created during a transaction and asserts no gRPC metrics were created
 *
 * @param {Object} params
 * @param {Object} params.t tap test
 * @param {Object} params.agent test agent
 */
util.assertMetricsNotExisting = function assertMetricsNotExisting({ t, agent }) {
  metrics.forEach((metricName) => {
    const metric = agent.metrics.getMetric(metricName)
    t.notOk(metric, `${metricName} should not be recorded`)
  })

  t.end()
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
  const serverMethods = require('./grpc-server')(server)
  const proto = loadProtobufApi(grpc)
  server.addService(proto.Greeter.service, serverMethods)
  await new Promise((resolve, reject) => {
    server.bindAsync(SERVER_ADDR, credentials, (err, port) => {
      if (err) {
        reject(err)
      } else {
        resolve(port)
      }
    })
  })
  server.start()
  return { server, proto }
}

/**
 * Gets the client for the Greeter service
 *
 * @param {Object} grpc grpc module
 * @param {Object} proto protobuf API example.proto
 * @returns {Object} client grpc client for Greeter service
 */
util.getClient = function getClient(grpc, proto) {
  const credentials = grpc.credentials.createInsecure()
  return new proto.Greeter(CLIENT_ADDR, credentials)
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
 * Asserts the gRPC external segment and its relevant attributes: http.url,
 * http.method, grpc.statusCode, grpc.statusText
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
  expectedStatusText = 'OK'
}) {
  const methodName = util.getRPCName(fnName)
  const segmentName = `${EXTERNAL.PREFIX}${CLIENT_ADDR}${methodName}`
  metricsHelpers.assertSegments(tx.trace.root, [segmentName], { exact: false })
  const segment = metricsHelpers.findSegment(tx.trace.root, segmentName)
  const attributes = segment.getAttributes()
  t.equal(
    attributes['http.url'],
    `grpc://${CLIENT_ADDR}${methodName}`,
    'http.url attribute should be correct'
  )
  t.equal(attributes['http.method'], methodName, 'method name should be correct')
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
  metricsHelpers.assertMetrics(tx.metrics, [expectedMetrics], false, false)
  t.end()
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
util.makeClientStreamingRequest = function makeClientStreamingRequest({ client, fnName, payload }) {
  return new Promise((resolve, reject) => {
    const call = client[fnName]((err, response) => {
      if (err) {
        reject(err)
        return
      }

      resolve(response)
    })

    payload.forEach((data) => call.write(data))
    call.end()
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
