/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const sinon = require('sinon')

const AWS_REGION = 'us-east-1'

tap.test('DynamoDB', (t) => {
  t.beforeEach(async (t) => {
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent()
    const Shim = require('../../../lib/shim/datastore-shim')
    t.context.setDatastoreSpy = sinon.spy(Shim.prototype, 'setDatastore')
    const lib = require('@aws-sdk/client-dynamodb')
    t.context.lib = lib
    const DynamoDBClient = lib.DynamoDBClient
    t.context.DynamoDBClient = DynamoDBClient
    t.context.client = new DynamoDBClient({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      region: AWS_REGION
    })

    const tableName = `delete-aws-sdk-test-table-${Math.floor(Math.random() * 100000)}`
    t.context.tableName = tableName
    t.context.commands = createCommands({ lib, tableName })
  })

  t.afterEach(async (t) => {
    t.context.setDatastoreSpy.restore()
    t.context.server.destroy()
    helper.unloadAgent(t.context.agent)
    Object.keys(require.cache).forEach((key) => {
      if (
        key.includes('@aws-sdk/client-dynamodb') ||
        key.includes('@aws-sdk/smithy-client') ||
        key.includes('@smithy/smithy-client')
      ) {
        delete require.cache[key]
      }
    })
  })

  // See: https://github.com/newrelic/node-newrelic-aws-sdk/issues/160
  // I do not care if this fails. the test is to make sure the instrumentation
  // does not crash
  t.test('real endpoint test', async (t) => {
    const {
      DynamoDBClient,
      lib: { QueryCommand },
      tableName
    } = t.context
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
    const { agent, commands, client } = t.context
    helper.runInTransaction(agent, async (tx) => {
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
    const { agent, commands, client } = t.context
    helper.runInTransaction(agent, async (tx) => {
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
  t.end()

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

    t.equal(
      t.context.setDatastoreSpy.callCount,
      1,
      'should only call setDatastore once and not per call'
    )
    t.end()
  }
})

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
