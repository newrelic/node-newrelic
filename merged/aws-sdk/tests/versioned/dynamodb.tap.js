'use strict'

const common = require('./common')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const async = require('async')

const TableName = 'test-table-' + Math.floor(Math.random() * 100000)
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
  TableName
}
const ITEM_DEF = {
  Item: {
    AlbumTitle: {S: 'Somewhat Famous'},
    Artist: {S: 'No One You Know'},
    SongTitle: {S: 'Call Me Today'}
  },
  TableName
}

const ITEM = {
  Key: {
    Artist: {S: 'No One You Know'},
    SongTitle: {S: 'Call Me Today'}
  },
  TableName
}
const QUERY = {
  ExpressionAttributeValues: {
    ':v1': {S: 'No One You Know'}
  },
  KeyConditionExpression: 'Artist = :v1',
  TableName
}

const TESTS = [
  {method: 'createTable', params: TABLE_DEF},
  {method: 'putItem', params: ITEM_DEF},
  {method: 'getItem', params: ITEM},
  {method: 'updateItem', params: ITEM},
  {method: 'scan', params: {TableName}},
  {method: 'query', params: QUERY},
  {method: 'deleteItem', params: ITEM},
  {method: 'deleteTable', params: {TableName}}
]

tap.test('DynamoDB', (t) => {
  t.autoend()

  let helper = null
  let AWS = null
  let ddb = null

  t.beforeEach((done) => {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'aws-sdk',
      type: 'conglomerate',
      onRequire: require('../../lib/instrumentation')
    })
    AWS = require('aws-sdk')
    ddb = new AWS.DynamoDB({region: 'us-east-2'})
    done()
  })

  t.afterEach((done) => {
    helper && helper.unload()
    done()
  })

  t.test('commands', (t) => {
    t.tearDown(() => {
      ddb.deleteTable({TableName}, () => {})
    })

    helper.runInTransaction((tx) => {
      async.eachSeries(TESTS, (cfg, cb) => {
        t.comment(`Testing ${cfg.method}`)
        ddb[cfg.method](cfg.params, (err) => {
          if (err && err.code !== 'ResourceNotFoundException') {
            t.error(err)
          }
          if (cfg.method === 'createTable') {
            // tables take a while to create
            t.comment('Waiting for table to be created...')
            ddb.waitFor('tableExists', {TableName}, cb)
          } else {
            cb()
          }
        })
      }, () => {
        tx.end()
        setImmediate(finish, t, tx)
      })
    })
  })
})

function finish(t, tx) {
  const segments = common.checkAWSAttributes(
    t,
    tx.trace.root,
    /^Datastore/
  )
  t.equal(segments.length, 8, 'should have 8 aws datastore segments')

  segments.forEach((segment, i) => {
    t.matches(segment.parameters, {
      'host': String,
      'port_path_or_id': String,
      'database_name': String,
      'aws.operation': TESTS[i].method,
      'aws.requestId': String
      // 'aws.service': 'DynamoDB' // TODO: Bring back service name.
    }, 'should have expected attributes')
  })

  t.end()
}
