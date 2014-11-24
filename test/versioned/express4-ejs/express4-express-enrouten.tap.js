'use strict'

var path    = require('path')
    , test    = require('tap').test
    , request = require('request')
    , helper  = require('../../lib/agent_helper.js')


test("Express 4 router introspection", function (t) {
    t.plan(2)

    var agent   = helper.instrumentMockedAgent()
        , express = require('express')
        , enrouten= require('express-enrouten')
        , app     = express()
        , server  = require('http').createServer(app)

    app.use(enrouten({directory:'./fixtures'}));

    this.tearDown(function cb_tearDown() {
        server.close(function cb_close() {
            helper.unloadAgent(agent)
        })
    })


    //New Relic + express-enrouten used to have a bug, where any routes after the first one would be lost.
    server.listen(8080, function () {
        request.get('http://localhost:8080/',
            function (error, res, body) {

                t.equal(res.statusCode, 200, 'First Route loaded')
            })

        request.get('http://localhost:8080/foo',
            function (error, res, body) {
                t.equal(res.statusCode, 200, 'Second Route loaded')
            })
    })
});
