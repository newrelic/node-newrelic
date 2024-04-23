/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('DynamoDB', (t) => {
  t.beforeEach(async (t) => {
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent()
    const lib = require('@aws-sdk/lib-dynamodb')
    t.context.DynamoDBDocument = lib.DynamoDBDocument
    t.context.DynamoDBDocumentClient = lib.DynamoDBDocumentClient
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
    t.context.ddbCommands = {
      PutCommand: lib.PutCommand,
      GetCommand: lib.GetCommand,
      UpdateCommand: lib.UpdateCommand,
      DeleteCommand: lib.DeleteCommand,
      QueryCommand: lib.QueryCommand,
      ScanCommand: lib.ScanCommand
    }

    const endpoint = `http://localhost:${server.address().port}`
    t.context.client = new DynamoDBClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })

    const tableName = `delete-aws-sdk-test-table-${Math.floor(Math.random() * 100000)}`
    t.context.tests = createTests(tableName)
  })

  t.afterEach((t) => {
    t.context.server.destroy()
    helper.unloadAgent(t.context.agent)
    Object.keys(require.cache).forEach((key) => {
      if (
        key.includes('@aws-sdk/lib-dynamodb') ||
        key.includes('@aws-sdk/client-dynamodb') ||
        key.includes('@aws-sdk/smithy-client') ||
        key.includes('@smithy/smithy-client')
      ) {
        delete require.cache[key]
      }
    })
  })

  t.test('client commands', (t) => {
    const { DynamoDBDocumentClient, ddbCommands, client, agent, tests } = t.context
    const docClient = new DynamoDBDocumentClient(client)
    helper.runInTransaction(agent, async function (tx) {
      for (let i = 0; i < tests.length; i++) {
        const cfg = tests[i]
        t.comment(`Testing ${cfg.operation}`)

        try {
          await docClient.send(new ddbCommands[cfg.command](cfg.params))
        } catch (err) {
          t.error(err)
        }
      }

      tx.end()

      const args = [t, tests, tx]
      setImmediate(finish, ...args)
    })
  })

  t.test('client commands via callback', (t) => {
    const { DynamoDBDocumentClient, ddbCommands, client, agent, tests } = t.context
    const docClient = new DynamoDBDocumentClient(client)
    helper.runInTransaction(agent, async function (tx) {
      for (const test of tests) {
        t.comment(`Testing ${test.operation}`)

        await new Promise((resolve) => {
          docClient.send(new ddbCommands[test.command](test.params), (err) => {
            t.error(err)

            return setImmediate(resolve)
          })
        })
      }

      tx.end()

      const args = [t, tests, tx]
      setImmediate(finish, ...args)
    })
  })

  t.test('client from commands', (t) => {
    const { DynamoDBDocumentClient, ddbCommands, client, agent, tests } = t.context
    const docClientFrom = DynamoDBDocumentClient.from(client)
    helper.runInTransaction(agent, async function (tx) {
      for (let i = 0; i < tests.length; i++) {
        const cfg = tests[i]
        t.comment(`Testing ${cfg.operation}`)

        try {
          await docClientFrom.send(new ddbCommands[cfg.command](cfg.params))
        } catch (err) {
          t.error(err)
        }
      }

      tx.end()

      const args = [t, tests, tx]
      setImmediate(finish, ...args)
    })
  })

  t.test('calling send on client and doc client', (t) => {
    const { DynamoDBDocumentClient, ddbCommands, client, agent, tests } = t.context
    const docClientFrom = DynamoDBDocumentClient.from(client)
    let errorOccurred = false
    helper.runInTransaction(agent, async function (tx) {
      for (let i = 0; i < tests.length; i++) {
        const cfg = tests[i]
        t.comment(`Testing ${cfg.operation}`)

        try {
          await docClientFrom.send(new ddbCommands[cfg.command](cfg.params))
          await client.send(new ddbCommands[cfg.command](cfg.params))
        } catch (err) {
          errorOccurred = true
          t.error(err)
        }
      }

      t.notOk(errorOccurred, 'should not have a middleware error with two clients')

      tx.end()
      t.end()
    })
  })

  t.test('DynamoDBDocument client from commands', (t) => {
    const { DynamoDBDocument, ddbCommands, client, agent, tests } = t.context
    const docClientFrom = DynamoDBDocument.from(client)
    helper.runInTransaction(agent, async function (tx) {
      for (let i = 0; i < tests.length; i++) {
        const cfg = tests[i]
        t.comment(`Testing ${cfg.operation}`)

        try {
          await docClientFrom.send(new ddbCommands[cfg.command](cfg.params))
        } catch (err) {
          t.error(err)
        }
      }

      tx.end()

      const args = [t, tests, tx]
      setImmediate(finish, ...args)
    })
  })
  t.end()
})

function finish(t, tests, tx) {
  const root = tx.trace.root
  const segments = common.checkAWSAttributes(t, root, common.DATASTORE_PATTERN)

  t.equal(segments.length, tests.length, `should have ${tests.length} aws datastore segments`)

  const externalSegments = common.checkAWSAttributes(t, root, common.EXTERN_PATTERN)
  t.equal(externalSegments.length, 0, 'should not have any External segments')

  segments.forEach((segment, i) => {
    const operation = tests[i].operation
    t.equal(
      segment.name,
      `Datastore/operation/DynamoDB/${operation}`,
      'should have operation in segment name'
    )
    const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
    attrs.port_path_or_id = parseInt(attrs.port_path_or_id, 10)
    t.match(
      attrs,
      {
        'host': String,
        'port_path_or_id': Number,
        'product': 'DynamoDB',
        'collection': String,
        'aws.operation': operation,
        'aws.requestId': String,
        'aws.region': 'us-east-1',
        'aws.service': 'DynamoDB'
      },
      'should have expected attributes'
    )
  })

  t.end()
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
