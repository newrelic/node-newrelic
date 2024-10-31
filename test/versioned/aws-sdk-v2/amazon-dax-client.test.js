/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const common = require('../aws-sdk-v3/common')
const helper = require('../../lib/agent_helper')
const { FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { match } = require('../../lib/custom-assertions')

// This will not resolve / allow web requests. Even with real ones, requests
// have to execute within the same VPC as the DAX configuration. When adding DAX support,
// we may be able to fake part of this via nock or similar.
const DAX_ENDPOINTS = [
  'this.is.not.real1.amazonaws.com:8111',
  'this.is.not.real2.amazonaws.com:8111'
]

test('amazon-dax-client', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
    const AWS = require('aws-sdk')
    const AmazonDaxClient = require('amazon-dax-client')

    const daxClient = new AmazonDaxClient({
      credentials: FAKE_CREDENTIALS,
      endpoints: DAX_ENDPOINTS,
      maxRetries: 0 // fail fast
    })
    ctx.nr.docClient = new AWS.DynamoDB.DocumentClient({ service: daxClient })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should not crash when using DAX', (t, end) => {
    const { agent, docClient } = t.nr
    helper.runInTransaction(agent, () => {
      // We don't need a successful case to repro
      const getParam = getDocItemParams('TableDoesNotExist', 'ArtistDoesNotExist')
      docClient.get(getParam, (err) => {
        assert.ok(err)
        end()
      })
    })
  })

  await t.test('should capture instance data as unknown using DAX', (t, end) => {
    const { agent, docClient } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      // We don't need a successful case to repro
      const getParam = getDocItemParams('TableDoesNotExist', 'ArtistDoesNotExist')
      docClient.get(getParam, (err) => {
        assert.ok(err)

        const root = transaction.trace.root

        // Won't have the attributes cause not making web request...
        const segments = common.getMatchingSegments({
          trace: transaction.trace,
          segment: root,
          pattern: common.DATASTORE_PATTERN
        })

        assert.equal(segments.length, 1)

        const externalSegments = common.checkAWSAttributes({
          trace: transaction.trace,
          segment: root,
          pattern: common.EXTERN_PATTERN
        })
        assert.equal(externalSegments.length, 0, 'should not have any External segments')

        const segment = segments[0]
        assert.equal(segment.name, 'Datastore/operation/DynamoDB/getItem')

        const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
        match(attrs, {
          host: 'unknown',
          port_path_or_id: 'unknown',
          collection: 'TableDoesNotExist',
          product: 'DynamoDB'
        })
        end()
      })
    })
  })
})

function getDocItemParams(tableName, uniqueArtist) {
  return {
    Key: {
      Artist: uniqueArtist,
      SongTitle: 'Call Me Today'
    },
    TableName: tableName
  }
}
