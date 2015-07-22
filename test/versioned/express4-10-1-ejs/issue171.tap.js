'use strict'

var path   = require('path')
  , helper = require('../../lib/agent_helper.js')

helper.instrumentMockedAgent()

var test = require('tap').test
  , http = require('http')
  , app  = require('express')()
  

test("adding 'handle' middleware", function (t) {
  t.plan(2)

  function handle(err, req, res, next) {
    t.ok(err, 'error should exist')

    res.statusCode = 500
    res.end()
  }

  app.use('/', function(req, res){
    throw new Error()
  })

  app.use(handle)

  var server = app.listen(function(){
    var port = server.address().port

    http.request({port: port}, function(res){

      // drain response to let process exit
      res.pipe(process.stderr)

      t.equal(res.statusCode, 500)
      server.close()
    }).end()
  })
})
