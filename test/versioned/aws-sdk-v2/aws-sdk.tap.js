/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const sinon = require('sinon')
const tap = require('tap')
const helper = require('../../lib/agent_helper')
const symbols = require('../../../lib/symbols')

const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('aws-sdk', (t) => {
  t.autoend()

  t.beforeEach(async (t) => {
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    t.context.server = server

    t.context.agent = helper.instrumentMockedAgent()
    const AWS = require('aws-sdk')
    AWS.config.update({ region: 'us-east-1' })
    t.context.AWS = AWS

    t.context.endpoint = `http://localhost:${server.address().port}`
  })

  t.afterEach((t) => {
    t.context.server.close()
    helper.unloadAgent(t.context.agent)
  })

  t.test('should mark requests to be dt-disabled', (t) => {
    const { AWS, endpoint } = t.context
    // http because we've changed endpoint to be http
    const http = require('http')
    sinon.spy(http, 'request')
    t.teardown(() => {
      // `afterEach` runs before `tearDown`, so the sinon spy may have already
      // been removed.
      if (http.request.restore) {
        http.request.restore()
      }
    })

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      credentials: FAKE_CREDENTIALS,
      endpoint: endpoint,
      // allows using generic endpoint, instead of needing a
      // bucket.endpoint server setup.
      s3ForcePathStyle: true,
      params: { Bucket: 'bucket' }
    })
    s3.listObjects({ Delimiter: '/' }, (err) => {
      t.error(err)

      if (t.ok(http.request.calledOnce, 'should call http.request')) {
        const args = http.request.getCall(0).args
        const headers = args[0].headers
        t.equal(headers[symbols.disableDT], true)
      }
      t.end()
    })
  })

  t.test('should maintain transaction state in promises', (t) => {
    const { AWS, endpoint, agent } = t.context
    const service = new AWS.SES({
      credentials: FAKE_CREDENTIALS,
      endpoint
    })

    helper.runInTransaction(agent, (tx) => {
      service
        .cloneReceiptRuleSet({
          OriginalRuleSetName: 'RuleSetToClone',
          RuleSetName: 'RuleSetToCreate'
        })
        .promise()
        .then(() => {
          t.equal(tx.id, agent.getTransaction().id)
          tx.end()
          ender()
        })
    })

    // Run two concurrent promises to check for conflation
    helper.runInTransaction(agent, (tx) => {
      service
        .cloneReceiptRuleSet({
          OriginalRuleSetName: 'RuleSetToClone',
          RuleSetName: 'RuleSetToCreate'
        })
        .promise()
        .then(() => {
          t.equal(tx.id, agent.getTransaction().id)
          tx.end()
          ender()
        })
    })

    let count = 0
    function ender() {
      if (++count === 2) {
        t.end()
      }
    }
  })
})
