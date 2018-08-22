'use strict'

const test = require('tap').test
const util = require('util')
const helper = require('../../lib/agent_helper')

test('promisify', function(t) {
  t.plan(1)
  t.test('should work on setTimeout', {skip: !util.promisify}, function(t) {
    t.plan(1)
    var agent = helper.instrumentMockedAgent()
    t.tearDown(function() {
      helper.unloadAgent(agent)
    })
    let asyncTimeout = util.promisify(setTimeout)
    asyncTimeout(10)
      .then(() => {
        t.ok('should evaluate properly')
        t.end()
      })
      .catch(ex => {
        t.error(ex)
      })
  })
})
