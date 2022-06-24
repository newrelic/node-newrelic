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
const { CLIENT_ADDR } = require('./constants')

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
  const helloCStreamName = '/helloworld.Greeter/SayHelloCStream'
  const helloSStreamName = '/helloworld.Greeter/SayHelloSStream'
  const errorName = '/helloworld.Greeter/SayError'
  const rollupHost = `${EXTERNAL.PREFIX}${CLIENT_ADDR}/all`
  const grpcMetricName = `${EXTERNAL.PREFIX}${CLIENT_ADDR}/gRPC`
  const metrics = [grpcMetricName, rollupHost, EXTERNAL.WEB, EXTERNAL.ALL]

  t.beforeEach(async () => {
    agent = helper.instrumentMockedAgent()
    grpc = require('@grpc/grpc-js')
    const { getServer, getClient } = require('./util')
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

  t.test('should track unary client requests as an external when in a transaction', (t) => {
    helper.runInTransaction(agent, 'web', async (tx) => {
      agent.on('transactionFinished', (transaction) => {
        const segment = transaction.trace.root.children[0]
        segmentName = `${EXTERNAL.PREFIX}${CLIENT_ADDR}${helloName}`
        t.equal(segment.name, segmentName, 'segment name is correct')
        const attributes = segment.getAttributes()
        t.equal(
          attributes['http.url'],
          `grpc://${CLIENT_ADDR}${helloName}`,
          'http.url attribute should be correct'
        )
        t.equal(attributes['http.method'], helloName, 'method name should be correct')
        t.equal(attributes['grpc.statusCode'], 0, 'status code should be zero')
        t.equal(attributes['grpc.statusText'], 'OK', 'status text should be OK')
        t.equal(attributes.component, 'gRPC', 'should have the component set to "gRPC"')

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

  t.test('should track client streaming requests as an external when in a transaction', (t) => {
    helper.runInTransaction(agent, 'web', async (tx) => {
      agent.on('transactionFinished', (transaction) => {
        const segment = transaction.trace.root.children[0]
        segmentName = `${EXTERNAL.PREFIX}${CLIENT_ADDR}${helloCStreamName}`
        t.equal(segment.name, segmentName, 'segment name is correct')
        const attributes = segment.getAttributes()
        t.equal(
          attributes['http.url'],
          `grpc://${CLIENT_ADDR}${helloCStreamName}`,
          'http.url attribute should be correct'
        )
        t.equal(attributes['http.method'], helloCStreamName, 'method name should be correct')
        t.equal(attributes['grpc.statusCode'], 0, 'status code should be zero')
        t.equal(attributes['grpc.statusText'], 'OK', 'status text should be OK')
        t.equal(attributes.component, 'gRPC', 'should have the component set to "gRPC"')

        for (const metricName of metrics) {
          const metric = agent.metrics.getMetric(metricName)
          t.ok(metric.callCount > 0, `ensure ${metricName} was recorded`)
        }
        t.end()
      })

      await new Promise((resolve) => {
        const call = client.sayHelloCStream((err, response) => {
          t.error(err)
          t.ok(response, 'response exists')
          t.equal(response.message, 'Hello bob, jordi, corey', 'response message is correct')
          tx.end()
          resolve()
        })

        const names = ['bob', 'jordi', 'corey']
        names.forEach((name) => call.write({ name }))
        call.end()
      })
    })
  })

  t.test('should track server streaming requests as an external when in a transaction', (t) => {
    helper.runInTransaction(agent, 'web', async (tx) => {
      agent.on('transactionFinished', (transaction) => {
        const segment = transaction.trace.root.children[0]
        segmentName = `${EXTERNAL.PREFIX}${CLIENT_ADDR}${helloSStreamName}`
        t.equal(segment.name, segmentName, 'segment name is correct')
        const attributes = segment.getAttributes()
        t.equal(
          attributes['http.url'],
          `grpc://${CLIENT_ADDR}${helloSStreamName}`,
          'http.url attribute should be correct'
        )
        t.equal(attributes['http.method'], helloSStreamName, 'method name should be correct')
        t.equal(attributes['grpc.statusCode'], 0, 'status code should be zero')
        t.equal(attributes['grpc.statusText'], 'OK', 'status text should be OK')
        t.equal(attributes.component, 'gRPC', 'should have the component set to "gRPC"')

        for (const metricName of metrics) {
          const metric = agent.metrics.getMetric(metricName)
          t.ok(metric.callCount > 0, `ensure ${metricName} was recorded`)
        }
        t.end()
      })

      await new Promise((resolve) => {
        const names = ['bob', 'jordi', 'corey']
        let counter = 0
        const call = client.sayHelloSStream({ name: names })
        call.on('data', function (response) {
          t.ok(response, 'response exists')
          t.equal(response.message, `Hello ${names[counter]}`, 'response stream message is correct')
          counter++
        })
        call.on('end', () => {
          tx.end()
          resolve()
        })
      })
    })
  })

  t.test('should include distributed trace headers when enabled', (t) => {
    helper.runInTransaction(agent, 'dt-test', async (tx) => {
      await new Promise((resolve) => {
        client.sayHello({ name: 'dt test' }, (err) => {
          t.error(err)
          const dtMeta = server.metadataMap.get('dt test')
          t.match(
            dtMeta.get('traceparent')[0],
            /^[\w\d\-]{55}$/,
            'should have traceparent in server metadata'
          )
          t.equal(dtMeta.get('newrelic')[0], '', 'should have newrelic in server metadata')
          tx.end()
          t.end()
          resolve()
        })
      })
    })
  })

  t.test('should not include distributed trace headers when not in transaction', async (t) => {
    await new Promise((resolve) => {
      client.sayHello({ name: 'dt test' }, (err) => {
        t.error(err)
        const dtMeta = server.metadataMap.get('dt test')
        t.notOk(dtMeta.has('traceparent'), 'should not have traceparent in server metadata')
        t.notOk(dtMeta.has('newrelic'), 'should not have newrelic in server metadata')
        t.end()
        resolve()
      })
    })
  })

  t.test(
    'should not include distributed trace headers when distributed_tracing.enabled is set to false',
    (t) => {
      agent.config.distributed_tracing.enabled = false
      helper.runInTransaction(agent, 'dt-test', async (tx) => {
        await new Promise((resolve) => {
          client.sayHello({ name: 'dt test' }, (err) => {
            t.error(err)
            const dtMeta = server.metadataMap.get('dt test')
            t.notOk(dtMeta.has('traceparent'), 'should not have traceparent in server metadata')
            t.notOk(dtMeta.has('newrelic'), 'should not have newrelic in server metadata')
            tx.end()
            t.end()
            resolve()
          })
        })
      })
    }
  )

  t.test('should not track external unary client requests outside of a transaction', async (t) => {
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
        const segment = transaction.trace.root.children[0]
        const attributes = segment.getAttributes()
        t.equal(agent.errors.traceAggregator.errors.length, 1, 'should record a single error')
        t.equal(
          attributes['http.url'],
          `grpc://${CLIENT_ADDR}${errorName}`,
          'http.url attribute should be correct'
        )
        t.equal(attributes['http.method'], errorName, 'method name should be correct')
        t.equal(
          attributes['grpc.statusCode'],
          grpc.status.FAILED_PRECONDITION,
          'status code should correspond to FAILED_PRECONDITION'
        )
        t.equal(
          attributes['grpc.statusText'],
          'i think i will cause problems on purpose',
          'status text should be error message'
        )
        t.equal(attributes.component, 'gRPC', 'should have the component set to "gRPC"')
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
