/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const protoLoader = require('@grpc/proto-loader')

const EXTERNAL = require('../../../lib/metrics/names').EXTERNAL

const helper = require('../../lib/agent_helper')

const PROTO_PATH = `${__dirname}/example.proto`
const SERVER_ADDR = '0.0.0.0:50051'
const CLIENT_ADDR = 'localhost:50051'

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
})

tap.test('grpc client instrumentation', (t) => {
  t.autoend()

  let agent
  let client
  let server
  let proto
  let grpc
  let segmentName

  const helloName = '/helloworld.Greeter/SayHello'
  const errorName = '/helloworld.Greeter/SayError'
  const rollupHost = `${EXTERNAL.PREFIX}${CLIENT_ADDR}/all`
  const grpcMetricName = `${EXTERNAL.PREFIX}${CLIENT_ADDR}/gRPC`
  const metrics = [grpcMetricName, rollupHost, EXTERNAL.WEB, EXTERNAL.ALL]

  t.beforeEach(async () => {
    agent = helper.instrumentMockedAgent()
    grpc = require('@grpc/grpc-js')
    proto = grpc.loadPackageDefinition(packageDefinition).helloworld
    server = await getServer(grpc, proto)
    client = getClient(grpc, proto)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    server.forceShutdown()
    client.close()
    grpc = null
    proto = null
  })

  t.test('should instrument client ping in a transaction', (t) => {
    helper.runInTransaction(agent, 'web', async (tx) => {
      agent.on('transactionFinished', (transaction) => {
        const myTx = transaction.trace.root.children[0]
        segmentName = `${EXTERNAL.PREFIX}${CLIENT_ADDR}${helloName}`
        t.equal(myTx.name, segmentName, 'segment name is correct')
        const { attributes } = myTx.attributes
        t.equal(
          attributes['http.url'].value,
          `grpc://${CLIENT_ADDR}${helloName}`,
          'http.url attribute should be correct'
        )
        t.equal(attributes['http.method'].value, helloName, 'method name should be correct')
        t.equal(attributes['grpc.statusCode'].value, 0, 'status code should be zero')
        t.equal(attributes.component.value, 'gRPC', 'should have the component set to "gRPC"')

        for (const metricName of metrics) {
          const metric = agent.metrics.getMetric(metricName)
          t.ok(metric.callCount > 0, `ensure ${metricName} was recorded`)
        }
        t.end()
      })

      await new Promise((resolve) => {
        client.sayHello({ name: 'New Relic' }, (err, response) => {
          t.error(err)
          t.ok(response, 'response exists')
          t.equal(response.message, 'Hello New Relic', 'response message is correct')
          tx.end()
          resolve()
        })
      })
    })
  })

  t.test('should not instrument client outside of a transaction', async (t) => {
    await new Promise((resolve) => {
      client.sayHello({ name: 'New Relic' }, (err, response) => {
        t.error(err)
        t.ok(response, 'response exists')
        t.equal(response.message, 'Hello New Relic', 'response message is correct')
        resolve()
      })
    })

    for (const metricName of metrics) {
      const metric = agent.metrics.getMetric(metricName)
      t.notOk(metric, `${metricName} should not be recorded`)
    }

    t.end()
  })

  t.test('should record errors in a transaction', (t) => {
    helper.runInTransaction(agent, 'web', async (tx) => {
      agent.on('transactionFinished', (transaction) => {
        const myTx = transaction.trace.root.children[0]
        const { attributes } = myTx.attributes
        t.equal(agent.errors.traceAggregator.errors.length, 1, 'should record a single error')
        t.equal(
          attributes['http.url'].value,
          `grpc://${CLIENT_ADDR}${errorName}`,
          'http.url attribute should be correct'
        )
        t.equal(attributes['http.method'].value, errorName, 'method name should be correct')
        t.equal(
          attributes['grpc.statusCode'].value,
          grpc.status.FAILED_PRECONDITION,
          'status code should correspond to FAILED_PRECONDITION'
        )
        t.equal(
          attributes['grpc.statusText'].value,
          'i think i will cause problems on purpose',
          'status text should be error message'
        )
        t.equal(attributes.component.value, 'gRPC', 'should have the component set to "gRPC"')
        const error = agent.errors.traceAggregator.errors[0][2]
        t.equal(error, 'i think i will cause problems on purpose', 'should have the error message')
        for (const metricName of metrics) {
          const metric = agent.metrics.getMetric(metricName)
          t.ok(metric.callCount > 0, `ensure ${metricName} was recorded`)
        }
      })

      await new Promise((resolve) => {
        client.sayError({ oh: 'noes' }, (err, response) => {
          t.ok(err, 'should get an error')
          t.notOk(response, 'response should not exist')
          t.equal(err.code, grpc.status.FAILED_PRECONDITION, 'should get the right status code')
          t.equal(
            err.details,
            'i think i will cause problems on purpose',
            'should get the correct error message'
          )
          tx.end()
          resolve()
        })
      })
      t.end()
    })
  })
})

async function getServer(grpc, proto) {
  const server = new grpc.Server()
  const credentials = grpc.ServerCredentials.createInsecure()
  const implementation = {
    sayHello: function sayHello({ request: { name } }, cb) {
      const message = 'Hello ' + name
      cb(null, { message })
    },
    sayError: function sayError(whatever, cb) {
      return cb({
        code: grpc.status.FAILED_PRECONDITION,
        message: 'i think i will cause problems on purpose'
      })
    }
  }

  server.addService(proto.Greeter.service, implementation)
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
  return server
}

function getClient(grpc, proto) {
  const credentials = grpc.credentials.createInsecure()
  return new proto.Greeter(CLIENT_ADDR, credentials)
}
