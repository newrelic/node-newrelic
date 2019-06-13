'use strict'

const common = require('./common')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const async = require('async')

const TABLE_NAME = 'StaticTestTable_DO_NOT_DELETE'
const FAKE_TABLE_NAME = 'NON-EXISTENT-TABLE'
const UNIQUE_ARTIST = `No One You Know ${Math.floor(Math.random() * 100000)}`

const TABLE_DEF = {
  AttributeDefinitions: [
    {AttributeName: 'Artist', AttributeType: 'S'},
    {AttributeName: 'SongTitle', AttributeType: 'S'}
  ],
  KeySchema: [
    {AttributeName: 'Artist', KeyType: 'HASH'},
    {AttributeName: 'SongTitle', KeyType: 'RANGE'}
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  },
  TableName: TABLE_NAME
}

const ITEM_DEF = {
  Item: {
    AlbumTitle: {S: 'Somewhat Famous'},
    Artist: {S: UNIQUE_ARTIST},
    SongTitle: {S: 'Call Me Today'}
  },
  TableName: TABLE_NAME
}

const ITEM = {
  Key: {
    Artist: {S: UNIQUE_ARTIST},
    SongTitle: {S: 'Call Me Today'}
  },
  TableName: TABLE_NAME
}

const DELETE_TABLE = {
  TableName: FAKE_TABLE_NAME
}

const QUERY = {
  ExpressionAttributeValues: {
    ':v1': {S: UNIQUE_ARTIST}
  },
  KeyConditionExpression: 'Artist = :v1',
  TableName: TABLE_NAME
}

const DOC_PUT_ITEM = {
  Item: {
    AlbumTitle: 'Somewhat Famous',
    Artist: UNIQUE_ARTIST,
    SongTitle: 'Call Me Today'
  },
  TableName: TABLE_NAME
}

const DOC_ITEM = {
  Key: {
    Artist: UNIQUE_ARTIST,
    SongTitle: 'Call Me Today'
  },
  TableName: TABLE_NAME
}

const DOC_QUERY = {
  ExpressionAttributeValues: {
    ':v1': UNIQUE_ARTIST
  },
  KeyConditionExpression: 'Artist = :v1',
  TableName: TABLE_NAME
}

let tests = null

function createTests(ddb, docClient) {
  const composedTests = [
    {api: ddb, method: 'createTable', params: TABLE_DEF, operation: 'createTable'},
    {api: ddb, method: 'putItem', params: ITEM_DEF, operation: 'putItem'},
    {api: ddb, method: 'getItem', params: ITEM, operation: 'getItem'},
    {api: ddb, method: 'updateItem', params: ITEM, operation: 'updateItem'},
    {api: ddb, method: 'scan', params: {TableName: TABLE_NAME}, operation: 'scan'},
    {api: ddb, method: 'query', params: QUERY, operation: 'query'},
    {api: ddb, method: 'deleteItem', params: ITEM, operation: 'deleteItem'},
    {api: ddb, method: 'deleteTable', params: DELETE_TABLE, operation: 'deleteTable'},

    {api: docClient, method: 'put', params: DOC_PUT_ITEM, operation: 'putItem'},
    {api: docClient, method: 'get', params: DOC_ITEM, operation: 'getItem'},
    {api: docClient, method: 'update', params: DOC_ITEM, operation: 'updateItem'},
    {api: docClient, method: 'scan', params: {TableName: TABLE_NAME}, operation: 'scan'},
    {api: docClient, method: 'query', params: DOC_QUERY, operation: 'query'},
    {api: docClient, method: 'delete', params: DOC_ITEM, operation: 'deleteItem'}
  ]

  return composedTests
}

tap.test('DynamoDB', (t) => {
  t.autoend()

  let helper = null
  let AWS = null

  t.beforeEach((done) => {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'aws-sdk',
      type: 'conglomerate',
      onRequire: require('../../lib/instrumentation')
    })

    AWS = require('aws-sdk')
    const ddb = new AWS.DynamoDB({region: 'us-east-1'})
    const docClient = new AWS.DynamoDB.DocumentClient({region: 'us-east-1'})

    tests = createTests(ddb, docClient)

    done()
  })

  t.afterEach((done) => {
    helper && helper.unload()

    helper = null
    AWS = null
    tests = null

    done()
  })

  t.test('commands', (t) => {
    helper.runInTransaction((tx) => {
      async.eachSeries(tests, (cfg, cb) => {
        t.comment(`Testing ${cfg.method}`)
        cfg.api[cfg.method](cfg.params, (err) => {
          if (
            err &&
            err.code !== 'ResourceNotFoundException' &&
            // The table should always exist
            err.code !== 'ResourceInUseException'
          ) {
            t.error(err)
          }
          cb()
        })
      }, () => {
        tx.end()
        setImmediate(finish, t, tx)
      })
    })
  })
})

function finish(t, tx) {
  const segments = common.checkAWSAttributes(t, tx.trace.root, /^Datastore/)

  t.equal(
    segments.length,
    tests.length,
    `should have ${tests.length} aws datastore segments`
  )

  segments.forEach((segment, i) => {
    const operation = tests[i].operation
    t.equal(
      segment.name,
      `Datastore/operation/DynamoDB/${operation}`,
      'should have operation in segment name'
    )
    const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
    t.matches(attrs, {
      'host': String,
      'port_path_or_id': String,
      'product': 'DynamoDB',
      'collection': String,
      'aws.operation': operation,
      'aws.requestId': String,
      'aws.region': 'us-east-1',
      'aws.service': 'DynamoDB'
    }, 'should have expected attributes')
  })

  t.end()
}
