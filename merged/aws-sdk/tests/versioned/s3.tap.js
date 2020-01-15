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

  t.test('commands with callbacks', (t) => {
    const Bucket = 'delete-aws-sdk-test-bucket-' + Math.floor(Math.random() * 100000)
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

            const args = [t, tx]
            setImmediate(finish, ...args)
          })
        })
      })
    })
  })

  t.test('commands with promises', (t) => {
    const Bucket = 'delete-aws-sdk-test-bucket-' + Math.floor(Math.random() * 100000)
    t.tearDown(() => {
      // Ensure bucket gets deleted even if test goes awry.
      S3.deleteBucket({Bucket}, () => {})
    })

    helper.runInTransaction(async tx => {
      const bucketParams = {Bucket}
      let headBucketError = null
      try {
        await S3.headBucket(bucketParams).promise()
      } catch (err) {
        headBucketError = err
      } finally {
        t.matches(headBucketError, {code: 'NotFound'}, 'should get not found for bucket')
      }

      try {
        const createData = await S3.createBucket(bucketParams).promise()
        t.matches(createData, {Location: `/${Bucket}`}, 'should have matching location')
      } catch (err) {
        t.error(err)
      }

      try {
        await S3.deleteBucket(bucketParams).promise()
      } catch (err) {
        // Sometimes S3 doesn't make the bucket quickly enough. The cleanup
        // in `t.tearDown` should get it after we do all our checks.
        if (err && err.code !== 'NoSuchBucket') {
          t.error(err)
        }
      }

      tx.end()

      const args = [t, tx]
      setImmediate(finish, ...args)
    })
  })
})

function finish(t, tx) {
  const externals = common.checkAWSAttributes(t, tx.trace.root, common.EXTERN_PATTERN)
  t.equal(externals.length, 3, 'should have 3 aws externals')
  const [head, create, del] = externals
  checkAttrs(t, head, 'headBucket')
  checkAttrs(t, create, 'createBucket')
  checkAttrs(t, del, 'deleteBucket')

  t.end()
}

function checkAttrs(t, segment, operation) {
  const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
  t.matches(attrs, {
    'aws.operation': operation,
    'aws.requestId': String,
    'aws.service': 'Amazon S3',
    'aws.region': 'us-east-1'
  }, `should have expected attributes for ${operation}`)
}
