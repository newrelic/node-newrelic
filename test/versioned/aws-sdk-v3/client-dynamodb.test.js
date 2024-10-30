/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const sinon = require('sinon')
const { match } = require('../../lib/custom-assertions')

const AWS_REGION = 'us-east-1'

test('DynamoDB', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent()
    const Shim = require('../../../lib/shim/datastore-shim')
    ctx.nr.setDatastoreSpy = sinon.spy(Shim.prototype, 'setDatastore')
    const lib = require('@aws-sdk/client-dynamodb')
    ctx.nr.lib = lib
    const DynamoDBClient = lib.DynamoDBClient
    ctx.nr.DynamoDBClient = DynamoDBClient
    ctx.nr.client = new DynamoDBClient({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      region: AWS_REGION
    })

    const tableName = `delete-aws-sdk-test-table-${Math.floor(Math.random() * 100000)}`
    ctx.nr.tableName = tableName
    ctx.nr.commands = createCommands({ lib, tableName })
  })

  t.afterEach((ctx) => {
    common.afterEach(ctx)
    ctx.nr.setDatastoreSpy.restore()
  })

  // See: https://github.com/newrelic/node-newrelic-aws-sdk/issues/160
  // I do not care if this fails. the test is to make sure the instrumentation
  // does not crash
  await t.test('real endpoint test', async (t) => {
    const {
      DynamoDBClient,
      lib: { QueryCommand },
      tableName
    } = t.nr
    const realClient = new DynamoDBClient({
      credentials: FAKE_CREDENTIALS,
      region: AWS_REGION
    })

    const cmd = new QueryCommand(getQueryParams(tableName, 'randomtest'))
    try {
      await realClient.send(cmd)
      throw new Error('this should fail with IncompleteSignatureException')
    } catch (err) {
      assert.equal(err.name, 'IncompleteSignatureException')
    }
  })

  await t.test('commands, promise-style', async (t) => {
    const { agent, commands, client, setDatastoreSpy } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      for (const command of commands) {
        await client.send(command)
      }
      tx.end()
      finish({ commands, tx, setDatastoreSpy })
    })
  })

  await t.test('commands, callback-style', async (t) => {
    const { agent, commands, client, setDatastoreSpy } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      for (const command of commands) {
        await new Promise((resolve) => {
          client.send(command, (err) => {
            assert.ok(!err)

            return setImmediate(resolve)
          })
        })
      }

      tx.end()
      finish({ commands, tx, setDatastoreSpy })
    })
  })
})

function createCommands({ lib, tableName }) {
  const {
    CreateTableCommand,
    PutItemCommand,
    GetItemCommand,
    UpdateItemCommand,
    ScanCommand,
    QueryCommand,
    DeleteItemCommand,
    BatchWriteItemCommand,
    BatchGetItemCommand,
    BatchExecuteStatementCommand,
    UpdateTableCommand,
    DeleteTableCommand
  } = lib
  const ddbUniqueArtist = `DELETE_One You Know ${Math.floor(Math.random() * 100000)}`
  const createTblParams = getCreateTableParams(tableName)
  const putItemParams = getPutItemParams(tableName, ddbUniqueArtist)
  const itemParams = getItemParams(tableName, ddbUniqueArtist)
  const queryParams = getQueryParams(tableName, ddbUniqueArtist)
  const batchWriteItemCommandParams = getBatchWriteItemCommandParams(tableName, ddbUniqueArtist)
  const batchGetItemCommandParams = getBatchGetItemCommandParams(tableName, ddbUniqueArtist)
  const batchExecuteStatementCommandParams = getBatchExecuteStatementCommandParams(
    tableName,
    ddbUniqueArtist
  )
  const updateTableCommandParams = getUpdateTableCommandParams(tableName)
  const deleteTableParams = getDeleteTableParams(tableName)
  const createTableCommand = new CreateTableCommand(createTblParams)
  const putItemCommand = new PutItemCommand(putItemParams)
  const getItemCommand = new GetItemCommand(itemParams)
  const updateItemCommand = new UpdateItemCommand(itemParams)
  const scanCommand = new ScanCommand({ TableName: tableName })
  const queryCommand = new QueryCommand(queryParams)
  const deleteItemCommand = new DeleteItemCommand(itemParams)
  const batchWriteItemCommand = new BatchWriteItemCommand(batchWriteItemCommandParams)
  const batchGetItemCommand = new BatchGetItemCommand(batchGetItemCommandParams)
  const batchExecuteStatementCommand = new BatchExecuteStatementCommand(
    batchExecuteStatementCommandParams
  )
  const updateTableCommand = new UpdateTableCommand(updateTableCommandParams)
  const deleteTableCommand = new DeleteTableCommand(deleteTableParams)
  return [
    createTableCommand,
    putItemCommand,
    getItemCommand,
    updateItemCommand,
    scanCommand,
    queryCommand,
    deleteItemCommand,
    batchWriteItemCommand,
    batchGetItemCommand,
    batchExecuteStatementCommand,
    updateTableCommand,
    deleteTableCommand
  ]
}

function finish({ commands, tx, setDatastoreSpy }) {
  const root = tx.trace.root
  const segments = common.checkAWSAttributes(root, common.DATASTORE_PATTERN)

  assert.equal(
    segments.length,
    commands.length,
    `should have ${commands.length} AWS datastore segments`
  )

  const externalSegments = common.checkAWSAttributes(root, common.EXTERN_PATTERN)
  assert.equal(externalSegments.length, 0, 'should not have any External segments')

  segments.forEach((segment, i) => {
    const command = commands[i]
    assert.ok(command)
    assert.equal(
      segment.name,
      `Datastore/operation/DynamoDB/${command.constructor.name}`,
      'should have operation in segment name'
    )
    const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
    attrs.port_path_or_id = parseInt(attrs.port_path_or_id, 10)

    match(attrs, {
      'host': String,
      'port_path_or_id': Number,
      'product': 'DynamoDB',
      'collection': String,
      'aws.operation': command.constructor.name,
      'aws.requestId': String,
      'aws.region': 'us-east-1',
      'aws.service': /dynamodb|DynamoDB/
    })
  })

  assert.equal(setDatastoreSpy.callCount, 1, 'should only call setDatastore once and not per call')
}

function getCreateTableParams(tableName) {
  return {
    AttributeDefinitions: [
      { AttributeName: 'Artist', AttributeType: 'S' },
      { AttributeName: 'SongTitle', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'Artist', KeyType: 'HASH' },
      { AttributeName: 'SongTitle', KeyType: 'RANGE' }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    },
    TableName: tableName
  }
}

function getPutItemParams(tableName, uniqueArtist) {
  return {
    Item: {
      AlbumTitle: { S: 'Somewhat Famous' },
      Artist: { S: uniqueArtist },
      SongTitle: { S: 'Call Me Today' }
    },
    TableName: tableName
  }
}

function getItemParams(tableName, uniqueArtist) {
  return {
    Key: {
      Artist: { S: uniqueArtist },
      SongTitle: { S: 'Call Me Today' }
    },
    TableName: tableName
  }
}

function getQueryParams(tableName, uniqueArtist) {
  return {
    ExpressionAttributeValues: {
      ':v1': { S: uniqueArtist }
    },
    KeyConditionExpression: 'Artist = :v1',
    TableName: tableName
  }
}

function getDeleteTableParams(tableName) {
  return {
    TableName: tableName
  }
}

function getBatchWriteItemCommandParams(tableName, uniqueArtist) {
  const params = {}
  params[tableName] = {
    RequestItems: [
      {
        PutRequest: {
          Key: {
            AlbumTitle: { S: 'Deltron 3030' },
            Artist: { S: uniqueArtist },
            SongTitle: { S: 'Virus' }
          }
        }
      }
    ]
  }
  return params
}

function getBatchGetItemCommandParams(tableName, uniqueArtist) {
  const params = {}
  params[tableName] = {
    RequestItems: {
      ConsistentRead: true,
      Keys: {
        Artist: { S: uniqueArtist }
      }
    }
  }
  return params
}

function getBatchExecuteStatementCommandParams(tableName, uniqueArtist) {
  const Statement = `SELECT * FROM ${tableName} x WHERE x.Artist = ${uniqueArtist}`
  return {
    Statements: [{ Statement }]
  }
}

function getUpdateTableCommandParams(tableName) {
  return {
    AttributeDefinitions: [{ AttributeName: 'AlbumTitle', AttributeType: 'S' }],
    TableName: tableName
  }
}
