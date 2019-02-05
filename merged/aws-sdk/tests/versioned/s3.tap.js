'use strict'

const common = require('./common')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')

process.env.AWS_ACCESS_KEY_ID = 'THIS_IS_A_FAKE_KEY_ID'
process.env.AWS_SECRET_ACCESS_KEY = 'THIS_IS_A_FAKE_SECRET_ACCESS_KEY'

tap.test('S3 buckets', (t) => {
  t.autoend()

  let helper = null
  let AWS = null
  let S3 = null

  t.beforeEach((done) => {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'aws-sdk',
      type: 'conglomerate',
      onRequire: require('../../lib/instrumentation')
    })
    AWS = require('aws-sdk')
    S3 = new AWS.S3({apiVersion: '2006-03-01'})
    done()
  })

  t.afterEach((done) => {
    helper && helper.unload()
    common.clearMockedRequests()
    done()
  })

  t.test('commands', (t) => {
    const Bucket = 'aws-sdk-test-bucket-' + Math.floor(Math.random() * 100)

    helper.runInTransaction((tx) => {
      S3.headBucket({Bucket}, (err) => {
        t.matches(err, {code: 'NotFound'}, 'should get not found for bucket')
        S3.createBucket({Bucket}, (err) => {
          t.error(err)
          S3.deleteBucket({Bucket}, (err) => {
            t.error(err)
            tx.end()
            setImmediate(finish, tx)
          })
        })
      })
    })

    function finish(tx) {
      const externals = common.checkAWSExternals(t, tx.trace.root)
      t.equal(externals.length, 3, 'should have 3 aws externals')
      const [head, create, del] = externals

      t.matches(head.parameters, {
        'aws.operation': 'headBucket',
        'aws.requestId': 'id-1',
        'aws.service': 'S3'
      }, 'should have expected parameters')
      t.matches(create.parameters, {
        'aws.operation': 'createBucket',
        'aws.requestId': 'id-2',
        'aws.service': 'S3'
      }, 'should have expected parameters')
      t.matches(del.parameters, {
        'aws.operation': 'deleteBucket',
        'aws.requestId': 'id-3',
        'aws.service': 'S3'
      }, 'should have expected parameters')

      t.end()
    }
  })
})
