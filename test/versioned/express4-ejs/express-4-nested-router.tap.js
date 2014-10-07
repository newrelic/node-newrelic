'use strict';

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper.js'))
  ;

test("Express 4 nested routing", function (t) {
  t.plan(10);

  var agent   = helper.instrumentMockedAgent()
    , express = require('express')
    , app     = express()
    , server  = require('http').createServer(app)
    ;

  this.tearDown(function cb_tearDown() {
    server.close(function cb_close() {
      helper.unloadAgent(agent);
    });
  });

  // need to capture parameters
  agent.config.capture_params = true;

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Expressjs/GET//home/test',
            "transaction has expected name");
    t.equal(transaction.url, '/home/test', "URL is left alone");
    t.equal(transaction.statusCode, 200, "status code is OK");
    t.equal(transaction.verb, 'GET', "HTTP method is GET");
    t.ok(transaction.trace, "transaction has trace");

    var web = transaction.trace.root.children[0];
    t.ok(web, "trace has web segment");
    t.equal(web.name, transaction.name, "segment name and transaction name match");
    t.equal(web.partialName, 'Expressjs/GET//home/test',
            "should have partial name for apdex");
  });

  app.use('/home', (
    function () {
      var router = express.Router();
      router.get('/test', function (req, res) {
        t.ok(agent.getTransaction(), "transaction is available");

        res.status(200).end();
      });
    }
  )());

  server.listen(8080, function () {
    request.get('http://localhost:8080/home/test',
                function (error, res, body) {

      t.equal(res.statusCode, 200, "nothing exploded");
    });
  });
});
