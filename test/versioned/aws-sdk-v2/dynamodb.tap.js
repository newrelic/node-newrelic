/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const common = require('../aws-sdk-v3/common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('DynamoDB', (t) => {
  t.autoend()

  t.beforeEach(async (t) => {
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    t.context.server = server

    t.context.agent = helper.instrumentMockedAgent()

    const AWS = require('aws-sdk')

    const endpoint = `http://localhost:${server.address().port}`
    const ddb = new AWS.DynamoDB({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
    const docClient = new AWS.DynamoDB.DocumentClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })

    const tableName = `delete-aws-sdk-test-table-${Math.floor(Math.random() * 100000)}`
    t.context.tests = createTests(ddb, docClient, tableName)
  })

  t.afterEach((t) => {
    t.context.server.close()
    helper.unloadAgent(t.context.agent)
  })

  t.test('commands with callback', (t) => {
    const { tests, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      for (const test of tests) {
        t.comment(`Testing ${test.method}`)

        await new Promise((resolve) => {
          test.api[test.method](test.params, (err) => {
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

  t.test('commands with promises', (t) => {
    const { tests, agent } = t.context
    helper.runInTransaction(agent, async function (tx) {
      // Execute commands in order
      // Await works because this is in a for-loop / no callback api
      for (let i = 0; i < tests.length; i++) {
        const cfg = tests[i]

        t.comment(`Testing ${cfg.method}`)

        try {
          await cfg.api[cfg.method](cfg.params).promise()
        } catch (err) {
          t.error(err)
        }
      }

      tx.end()

      const args = [t, tests, tx]
      setImmediate(finish, ...args)
    })
  })
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

function createTests(ddb, docClient, tableName) {
  const ddbUniqueArtist = `DELETE_One You Know ${Math.floor(Math.random() * 100000)}`
  const createTblParams = getCreateTableParams(tableName)
  const putItemParams = getPutItemParams(tableName, ddbUniqueArtist)
  const itemParams = getItemParams(tableName, ddbUniqueArtist)
  const queryParams = getQueryParams(tableName, ddbUniqueArtist)
  const deleteTableParams = getDeleteTableParams(tableName)

  const docUniqueArtist = `DELETE_One You Know ${Math.floor(Math.random() * 100000)}`
  const docPutParams = getDocPutItemParams(tableName, docUniqueArtist)
  const docItemParams = getDocItemParams(tableName, docUniqueArtist)
  const docQueryParams = getDocQueryParams(tableName, docUniqueArtist)

  return [
    { api: ddb, method: 'createTable', params: createTblParams, operation: 'createTable' },
    { api: ddb, method: 'putItem', params: putItemParams, operation: 'putItem' },
    { api: ddb, method: 'getItem', params: itemParams, operation: 'getItem' },
    { api: ddb, method: 'updateItem', params: itemParams, operation: 'updateItem' },
    { api: ddb, method: 'scan', params: { TableName: tableName }, operation: 'scan' },
    { api: ddb, method: 'query', params: queryParams, operation: 'query' },
    { api: ddb, method: 'deleteItem', params: itemParams, operation: 'deleteItem' },

    { api: docClient, method: 'put', params: docPutParams, operation: 'putItem' },
    { api: docClient, method: 'get', params: docItemParams, operation: 'getItem' },
    { api: docClient, method: 'update', params: docItemParams, operation: 'updateItem' },
    { api: docClient, method: 'scan', params: { TableName: tableName }, operation: 'scan' },
    { api: docClient, method: 'query', params: docQueryParams, operation: 'query' },
    { api: docClient, method: 'delete', params: docItemParams, operation: 'deleteItem' },

    { api: ddb, method: 'deleteTable', params: deleteTableParams, operation: 'deleteTable' }
  ]
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
