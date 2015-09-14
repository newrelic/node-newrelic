var test = require('tap').test
var helper = require('../../lib/agent_helper')
var semver = require('semver')


test('should name middleware correctly', 
    {skip: semver.satisfies(process.version, '<4')}, 
    function (t) {

  var agent = helper.instrumentMockedAgent()

  var app = require('express')()
  var server

  this.tearDown(function cb_tearDown() {
    server.close()
    helper.unloadAgent(agent)
  })

  app.use('/', testMiddleware.bind(null))

  server = app.listen(0, function() { 
    t.equal(app._router.stack.length, 4,
            '4 middleware functions: query parser, Express, router, error trapper')
  
    var count = 0
    for (var i = 0; i < app._router.stack.length; i++) {
      var layer = app._router.stack[i]

      // route middleware doesn't have a name, sentinel is our error handler,
      // neither should be wrapped.
      if (layer.handle.name && layer.handle.name === 'testMiddleware') {
        count++
      }
    }
    t.equal(count, 1, 'should find only one testMiddleware function')
    t.end()
  })

  function testMiddleware(req, res, next) {
    next()
  }
})
