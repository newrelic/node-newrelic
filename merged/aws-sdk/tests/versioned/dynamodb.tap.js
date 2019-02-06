'use strict'

const common = require('./common')
const fixtures = require('./fixtures')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const async = require('async')

const TESTS = [
  {method: 'createTable', params: fixtures.tableDef},
  {method: 'putItem', params: fixtures.itemDef},
  {method: 'getItem', params: fixtures.item},
  {method: 'updateItem', params: fixtures.item},
  {method: 'scan', params: {TableName: 'Music'}},
  {method: 'query', params: fixtures.query},
  {method: 'deleteItem', params: fixtures.item},
  {method: 'deleteTable', params: {TableName: 'Music'}}
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
    const TableName = 'Music'

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
      'table_name': 'Music',
      'aws.operation': TESTS[i].method,
      'aws.requestId': String
      // 'aws.service': 'DynamoDB' // TODO: Bring back service name.
    }, 'should have expected attributes')
  })

  t.end()
}
