/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('../common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

const AWS_REGION = 'us-east-1'

tap.test('DynamoDB', (t) => {
  t.autoend()

  let helper = null

  let tableName = null
  let commands = null

  let server = null
  let client = null

  let CreateTableCommand = null
  let PutItemCommand = null
  let GetItemCommand = null
  let UpdateItemCommand = null
  let ScanCommand = null
  let QueryCommand = null
  let DeleteItemCommand = null
  let BatchWriteItemCommand = null
  let BatchGetItemCommand = null
  let BatchExecuteStatementCommand = null
  let UpdateTableCommand = null
  let DeleteTableCommand = null
  let DynamoDBClient = null

  t.beforeEach(async () => {
    server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    helper = utils.TestAgent.makeInstrumented()
    common.registerInstrumentation(helper)
    const lib = require('@aws-sdk/client-dynamodb')
    DynamoDBClient = lib.DynamoDBClient
    CreateTableCommand = lib.CreateTableCommand
    PutItemCommand = lib.PutItemCommand
    GetItemCommand = lib.GetItemCommand
    UpdateItemCommand = lib.UpdateItemCommand
    ScanCommand = lib.ScanCommand
    QueryCommand = lib.QueryCommand
    DeleteItemCommand = lib.DeleteItemCommand
    BatchWriteItemCommand = lib.BatchWriteItemCommand
    BatchGetItemCommand = lib.BatchGetItemCommand
    BatchExecuteStatementCommand = lib.BatchExecuteStatementCommand
    UpdateTableCommand = lib.UpdateTableCommand
    DeleteTableCommand = lib.DeleteTableCommand

    client = new DynamoDBClient({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      region: AWS_REGION
    })

    tableName = `delete-aws-sdk-test-table-${Math.floor(Math.random() * 100000)}`
    commands = createCommands()
  })

  t.afterEach(async () => {
    server.destroy()
    server = null

    helper && helper.unload()
    helper = null

    client = null

    CreateTableCommand = null
    PutItemCommand = null
    GetItemCommand = null
    UpdateItemCommand = null
    ScanCommand = null
    QueryCommand = null
    DeleteItemCommand = null
    BatchWriteItemCommand = null
    BatchGetItemCommand = null
    BatchExecuteStatementCommand = null
    UpdateTableCommand = null
    DeleteTableCommand = null
    DynamoDBClient = null

    Object.keys(require.cache).forEach((key) => {
      if (key.includes('@aws-sdk/client-dynamodb') || key.includes('@aws-sdk/smithy-client')) {
        delete require.cache[key]
      }
    })
  })

  // See: https://github.com/newrelic/node-newrelic-aws-sdk/issues/160
  // I do not care if this fails. the test is to make sure the instrumentation
  // does not crash
  t.test('real endpoint test', async (t) => {
    const realClient = new DynamoDBClient({
      credentials: FAKE_CREDENTIALS,
      region: AWS_REGION
    })

    const cmd = new QueryCommand(getQueryParams(tableName, 'randomtest'))
    try {
      await realClient.send(cmd)
      throw new Error('this should fail with IncompleteSignatureException')
    } catch (err) {
      t.equal(err.name, 'IncompleteSignatureException')
    }
  })

  t.test('commands, promise-style', (t) => {
    helper.runInTransaction(async (tx) => {
      for (const command of commands) {
        t.comment(`Testing ${command.constructor.name}`)
        try {
          await client.send(command)
        } catch (err) {
          t.error(err)
        }
      }
      tx.end()
      finish(t, commands, tx)
    })
  })

  t.test('commands, callback-style', (t) => {
    helper.runInTransaction(async (tx) => {
      for (const command of commands) {
        t.comment(`Testing ${command.constructor.name}`)

        await new Promise((resolve) => {
          client.send(command, (err) => {
            t.error(err)

            return setImmediate(resolve)
          })
        })
      }

      tx.end()
      finish(t, commands, tx)
    })
  })

  function createCommands() {
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

  function finish(t, cmds, tx) {
    const root = tx.trace.root
    const segments = common.checkAWSAttributes(t, root, common.DATASTORE_PATTERN)

    t.equal(segments.length, cmds.length, `should have ${cmds.length} AWS datastore segments`)

    const externalSegments = common.checkAWSAttributes(t, root, common.EXTERN_PATTERN)
    t.equal(externalSegments.length, 0, 'should not have any External segments')

    segments.forEach((segment, i) => {
      const command = cmds[i]
      t.ok(command)
      t.equal(
        segment.name,
        `Datastore/operation/DynamoDB/${command.constructor.name}`,
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
          'aws.operation': command.constructor.name,
          'aws.requestId': String,
          'aws.region': 'us-east-1',
          'aws.service': /dynamodb|DynamoDB/
        },
        'should have expected attributes'
      )
    })

    t.end()
  }
})

function getCreateTableParams(tableName) {
  const params = {
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

  return params
}

function getPutItemParams(tableName, uniqueArtist) {
  const params = {
    Item: {
      AlbumTitle: { S: 'Somewhat Famous' },
      Artist: { S: uniqueArtist },
      SongTitle: { S: 'Call Me Today' }
    },
    TableName: tableName
  }

  return params
}

function getItemParams(tableName, uniqueArtist) {
  const params = {
    Key: {
      Artist: { S: uniqueArtist },
      SongTitle: { S: 'Call Me Today' }
    },
    TableName: tableName
  }

  return params
}

function getQueryParams(tableName, uniqueArtist) {
  const params = {
    ExpressionAttributeValues: {
      ':v1': { S: uniqueArtist }
    },
    KeyConditionExpression: 'Artist = :v1',
    TableName: tableName
  }

  return params
}

function getDeleteTableParams(tableName) {
  const params = {
    TableName: tableName
  }

  return params
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
