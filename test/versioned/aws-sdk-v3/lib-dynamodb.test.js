/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { match } = require('../../lib/custom-assertions')

test('DynamoDB', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent()
    const lib = require('@aws-sdk/lib-dynamodb')
    ctx.nr.DynamoDBDocument = lib.DynamoDBDocument
    ctx.nr.DynamoDBDocumentClient = lib.DynamoDBDocumentClient
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
    ctx.nr.ddbCommands = {
      PutCommand: lib.PutCommand,
      GetCommand: lib.GetCommand,
      UpdateCommand: lib.UpdateCommand,
      DeleteCommand: lib.DeleteCommand,
      QueryCommand: lib.QueryCommand,
      ScanCommand: lib.ScanCommand
    }

    const endpoint = `http://localhost:${server.address().port}`
    ctx.nr.client = new DynamoDBClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })

    const tableName = `delete-aws-sdk-test-table-${Math.floor(Math.random() * 100000)}`
    ctx.nr.tests = createTests(tableName)
  })

  t.afterEach(common.afterEach)

  await t.test('client commands', (t, end) => {
    const { DynamoDBDocumentClient, ddbCommands, client, agent, tests } = t.nr
    const docClient = new DynamoDBDocumentClient(client)
    helper.runInTransaction(agent, async function (tx) {
      for (const test of tests) {
        await docClient.send(new ddbCommands[test.command](test.params))
      }

      tx.end()

      const args = [end, tests, tx]
      setImmediate(finish, ...args)
    })
  })

  await t.test('client commands via callback', (t, end) => {
    const { DynamoDBDocumentClient, ddbCommands, client, agent, tests } = t.nr
    const docClient = new DynamoDBDocumentClient(client)
    helper.runInTransaction(agent, async function (tx) {
      for (const test of tests) {
        await new Promise((resolve) => {
          docClient.send(new ddbCommands[test.command](test.params), (err) => {
            assert.ok(!err)

            return setImmediate(resolve)
          })
        })
      }

      tx.end()

      const args = [end, tests, tx]
      setImmediate(finish, ...args)
    })
  })

  await t.test('client from commands', (t, end) => {
    const { DynamoDBDocumentClient, ddbCommands, client, agent, tests } = t.nr
    const docClientFrom = DynamoDBDocumentClient.from(client)
    helper.runInTransaction(agent, async function (tx) {
      for (const test of tests) {
        await docClientFrom.send(new ddbCommands[test.command](test.params))
      }

      tx.end()

      const args = [end, tests, tx]
      setImmediate(finish, ...args)
    })
  })

  await t.test('calling send on client and doc client', async (t) => {
    const { DynamoDBDocumentClient, ddbCommands, client, agent, tests } = t.nr
    const docClientFrom = DynamoDBDocumentClient.from(client)
    await helper.runInTransaction(agent, async function (tx) {
      for (const test of tests) {
        await docClientFrom.send(new ddbCommands[test.command](test.params))
        await client.send(new ddbCommands[test.command](test.params))
      }

      tx.end()
    })
  })

  await t.test('DynamoDBDocument client from commands', (t, end) => {
    const { DynamoDBDocument, ddbCommands, client, agent, tests } = t.nr
    const docClientFrom = DynamoDBDocument.from(client)
    helper.runInTransaction(agent, async function (tx) {
      for (const test of tests) {
        await docClientFrom.send(new ddbCommands[test.command](test.params))
      }

      tx.end()

      const args = [end, tests, tx]
      setImmediate(finish, ...args)
    })
  })
})

function finish(end, tests, tx) {
  const root = tx.trace.root
  const segments = common.checkAWSAttributes({
    trace: tx.trace,
    segment: root,
    pattern: common.DATASTORE_PATTERN
  })

  assert.equal(segments.length, tests.length, `should have ${tests.length} aws datastore segments`)

  const externalSegments = common.checkAWSAttributes({
    trace: tx.trace,
    segment: root,
    pattern: common.EXTERN_PATTERN
  })
  assert.equal(externalSegments.length, 0, 'should not have any External segments')

  segments.forEach((segment, i) => {
    const operation = tests[i].operation
    assert.equal(
      segment.name,
      `Datastore/operation/DynamoDB/${operation}`,
      'should have operation in segment name'
    )
    const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
    attrs.port_path_or_id = parseInt(attrs.port_path_or_id, 10)
    match(attrs, {
      'host': String,
      'port_path_or_id': Number,
      'product': 'DynamoDB',
      'collection': String,
      'aws.operation': operation,
      'aws.requestId': String,
      'aws.region': 'us-east-1',
      'aws.service': 'DynamoDB'
    })
  })

  end()
}

function createTests(tableName) {
  const docUniqueArtist = `DELETE_One You Know ${Math.floor(Math.random() * 100000)}`
  const docPutParams = getDocPutItemParams(tableName, docUniqueArtist)
  const docItemParams = getDocItemParams(tableName, docUniqueArtist)
  const docQueryParams = getDocQueryParams(tableName, docUniqueArtist)

  return [
    { params: docPutParams, operation: 'PutItemCommand', command: 'PutCommand' },
    { params: docItemParams, operation: 'GetItemCommand', command: 'GetCommand' },
    { params: docItemParams, operation: 'UpdateItemCommand', command: 'UpdateCommand' },
    { params: { TableName: tableName }, operation: 'ScanCommand', command: 'ScanCommand' },
    { params: docQueryParams, operation: 'QueryCommand', command: 'QueryCommand' },
    { params: docItemParams, operation: 'DeleteItemCommand', command: 'DeleteCommand' }
  ]
}

function getDocPutItemParams(tableName, uniqueArtist) {
  return {
    Item: {
      AlbumTitle: 'Somewhat Famous',
      Artist: uniqueArtist,
      SongTitle: 'Call Me Today'
    },
    TableName: tableName
  }
}

function getDocItemParams(tableName, uniqueArtist) {
  return {
    Key: {
      Artist: uniqueArtist,
      SongTitle: 'Call Me Today'
    },
    TableName: tableName
  }
}

function getDocQueryParams(tableName, uniqueArtist) {
  return {
    ExpressionAttributeValues: {
      ':v1': uniqueArtist
    },
    KeyConditionExpression: 'Artist = :v1',
    TableName: tableName
  }
}
