/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
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
  let DeleteTableCommand = null

  t.beforeEach(async () => {
    server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    helper = utils.TestAgent.makeInstrumented()
    common.registerCoreInstrumentation(helper)
    helper.registerInstrumentation({
      moduleName: '@aws-sdk/client-dynamodb',
      type: 'datastore',
      onResolved: require('../../../lib/v3-client-dynamodb')
    })

    const lib = require('@aws-sdk/client-dynamodb')
    const DynamoDBClient = lib.DynamoDBClient
    CreateTableCommand = lib.CreateTableCommand
    PutItemCommand = lib.PutItemCommand
    GetItemCommand = lib.GetItemCommand
    UpdateItemCommand = lib.UpdateItemCommand
    ScanCommand = lib.ScanCommand
    QueryCommand = lib.QueryCommand
    DeleteItemCommand = lib.DeleteItemCommand
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
    DeleteTableCommand = null
  })

  t.test('commands', async (t) => {
    await helper.runInTransaction(async (tx) => {
      for (const command of commands) {
        t.comment(`Testing ${command.constructor.name}`)
        try {
          await client.send(command)
        } catch (err) {
          t.error(err)
        }
      }
      tx.end()
      await finish(t, commands, tx)
    })
  })

  function createCommands() {
    const ddbUniqueArtist = `DELETE_One You Know ${Math.floor(Math.random() * 100000)}`
    const createTblParams = getCreateTableParams(tableName)
    const putItemParams = getPutItemParams(tableName, ddbUniqueArtist)
    const itemParams = getItemParams(tableName, ddbUniqueArtist)
    const queryParams = getQueryParams(tableName, ddbUniqueArtist)
    const deleteTableParams = getDeleteTableParams(tableName)
    const createTableCommand = new CreateTableCommand(createTblParams)
    const putItemCommand = new PutItemCommand(putItemParams)
    const getItemCommand = new GetItemCommand(itemParams)
    const updateItemCommand = new UpdateItemCommand(itemParams)
    const scanCommand = new ScanCommand({ TableName: tableName })
    const queryCommand = new QueryCommand(queryParams)
    const deleteItemCommand = new DeleteItemCommand(itemParams)
    const deleteTableCommand = new DeleteTableCommand(deleteTableParams)
    return [
      createTableCommand,
      putItemCommand,
      getItemCommand,
      updateItemCommand,
      scanCommand,
      queryCommand,
      deleteItemCommand,
      deleteTableCommand
    ]
  }

  function finish(t, commands, tx) {
    const root = tx.trace.root
    const segments = common.checkAWSAttributes(t, root, common.DATASTORE_PATTERN)

    t.equal(
      segments.length,
      commands.length,
      `should have ${commands.length} AWS datastore segments`
    )

    const externalSegments = common.checkAWSAttributes(t, root, common.EXTERN_PATTERN)
    t.equal(externalSegments.length, 0, 'should not have any External segments')

    segments.forEach((segment, i) => {
      const command = commands[i]
      t.ok(command)
      t.equal(
        segment.name,
        `Datastore/operation/DynamoDB/${command.constructor.name}`,
        'should have operation in segment name'
      )
      const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
      t.equal(typeof attrs.host, 'string')
      t.equal(typeof attrs.port_path_or_id, 'string')
      t.equal(typeof attrs.collection, 'string')
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
