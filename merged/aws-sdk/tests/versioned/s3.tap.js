'use strict'

const common = require('./common')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')

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
    done()
  })

  t.test('commands', (t) => {
    const Bucket = 'aws-sdk-test-bucket-' + Math.floor(Math.random() * 100000)
    t.tearDown(() => {
      // Ensure bucket gets deleted even if test goes awry.
      S3.deleteBucket({Bucket}, () => {})
    })

    helper.runInTransaction((tx) => {
      S3.headBucket({Bucket}, (err) => {
        t.matches(err, {code: 'NotFound'}, 'should get not found for bucket')
        S3.createBucket({Bucket}, (err, data) => {
          t.error(err)
          t.matches(data, {Location: `/${Bucket}`}, 'should have matching location')
          S3.deleteBucket({Bucket}, (err) => {
            // Sometimes S3 doesn't make the bucket quickly enough. The cleanup
            // in `t.tearDown` should get it after we do all our checks.
            if (err && err.code !== 'NoSuchBucket') {
              t.error(err)
            }
            tx.end()
            setImmediate(finish, tx)
          })
        })
      })
    })

    function finish(tx) {
      const externals = common.checkAWSAttributes(t, tx.trace.root, common.EXTERN_PATTERN)
      t.equal(externals.length, 3, 'should have 3 aws externals')
      const [head, create, del] = externals
      checkAttrs(t, head, 'headBucket')
      checkAttrs(t, create, 'createBucket')
      checkAttrs(t, del, 'deleteBucket')

      t.end()
    }
  })
})

function checkAttrs(t, segment, operation) {
  const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
  t.matches(attrs, {
    'aws.operation': operation,
    'aws.requestId': String,
    'aws.service': 'Amazon S3',
    'aws.region': 'us-east-1'
  }, `should have expected attributes for ${operation}`)
}
