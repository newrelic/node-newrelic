/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('./collection-common')
const helper = require('../../lib/agent_helper')
const tap = require('tap')
const collections = ['testCollection', 'testCollection2']


tap.test('cursor duration tests', function(t) {
  let agent = null
  let client = null
  let db = null
  let collection = null
  t.autoend()

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent()
    const mongodb = require('mongodb')
    common.dropTestCollections(mongodb, collections, function(err) {
      if (err) {
        return done(err)
      }

      common.connect(mongodb, null, function(err, res) {
        if (err) {
          return done(err)
        }

        client = res.client
        db = res.db
        collection = db.collection('testCollection')
        common.populate(db, collection, done)
      })
    })
  })

  t.afterEach(function(done) {
    common.close(client, db, function(err) {
      helper.unloadAgent(agent)
      agent = null
      done(err)
    })
  })

  t.test('toArray callback duration should be greater than its parent wrapper', function(t) {
    helper.runInTransaction(agent, function() {
      collection.find({}).toArray(function onToArray(err, data) {
        const segment = agent.tracer.getSegment()
        const cbTime = segment.getExclusiveDurationInMillis()
        // current segment is this callback, must get its parent and parent's parent
        const mongoTime = segment.parent.getExclusiveDurationInMillis()
        const parentTime = segment.parent.parent.getExclusiveDurationInMillis()
        console.log('mongoTime', mongoTime, 'parentTime', parentTime, 'cbTime', cbTime)
        t.ok(mongoTime > parentTime, 'toArray duration should be longer than its parent')
        t.notOk(err)
        t.equal(data[0].i, 0)
        t.end()
      })
    })
  })

  t.test('toArray promise duration should be greater than its parent wrapper', function(t) {
    helper.runInTransaction(agent, async function() {
      const data = await collection.find({}).toArray()
      const segment = agent.tracer.getSegment()
      // asserts the toArray promise execution is longer than its parent
      // see https://github.com/newrelic/node-newrelic/issues/788
      const parentTime = segment.getExclusiveDurationInMillis()
      const mongoTime = segment.children[0].getExclusiveDurationInMillis()
      console.log('mongoTime', mongoTime, 'parentTime', parentTime)
      t.ok(mongoTime > parentTime, 'toArray promise duration should be longer than its parent')

      t.equal(data[0].i, 0)
      t.end()
    })
  })
})


