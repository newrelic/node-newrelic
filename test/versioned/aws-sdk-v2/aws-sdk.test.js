/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const sinon = require('sinon')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const symbols = require('../../../lib/symbols')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

test('aws-sdk', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    ctx.nr.server = server

    ctx.nr.agent = helper.instrumentMockedAgent()
    const AWS = require('aws-sdk')
    AWS.config.update({ region: 'us-east-1' })
    ctx.nr.AWS = AWS

    ctx.nr.endpoint = `http://localhost:${server.address().port}`
  })

  t.afterEach((ctx) => {
    ctx.nr.server.close()
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should mark requests to be dt-disabled', (t, end) => {
    const { AWS, endpoint } = t.nr
    // http because we've changed endpoint to be http
    const http = require('http')
    sinon.spy(http, 'request')
    t.after(() => {
      // `afterEach` runs before `tearDown`, so the sinon spy may have already
      // been removed.
      if (http.request.restore) {
        http.request.restore()
      }
    })

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      credentials: FAKE_CREDENTIALS,
      endpoint,
      // allows using generic endpoint, instead of needing a
      // bucket.endpoint server setup.
      s3ForcePathStyle: true,
      params: { Bucket: 'bucket' }
    })
    s3.listObjects({ Delimiter: '/' }, (err) => {
      assert.ok(!err)

      if (assert.ok(http.request.calledOnce, 'should call http.request')) {
        const args = http.request.getCall(0).args
        const headers = args[0].headers
        assert.equal(headers[symbols.disableDT], true)
      }
      end()
    })
  })

  await t.test('should maintain transaction state in promises', async (t) => {
    const { AWS, endpoint, agent } = t.nr
    const service = new AWS.SES({
      credentials: FAKE_CREDENTIALS,
      endpoint
    })

    const req1 = helper.runInTransaction(agent, (tx) => service
      .cloneReceiptRuleSet({
        OriginalRuleSetName: 'RuleSetToClone',
        RuleSetName: 'RuleSetToCreate'
      })
      .promise()
      .then(() => {
        assert.equal(tx.id, agent.getTransaction().id)
        tx.end()
      }))

    // Run two concurrent promises to check for conflation
    const req2 = helper.runInTransaction(agent, (tx) => service
      .cloneReceiptRuleSet({
        OriginalRuleSetName: 'RuleSetToClone',
        RuleSetName: 'RuleSetToCreate'
      })
      .promise()
      .then(() => {
        assert.equal(tx.id, agent.getTransaction().id)
        tx.end()
      }))

    await Promise.all([req1, req2])
  })
})
