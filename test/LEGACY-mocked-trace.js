'use strict';

var path = require('path')
  , sinon = require('sinon')
  , database = require(path.join(__dirname, '..', 'lib', 'legacy', 'database'))
  , trace = require(path.join(__dirname, '..', 'lib', 'trace'))
  , mysqlInstrument = require(path.join(__dirname, '..', 'lib', 'instrumentation', 'mysql'))
  , Agent = require(path.join(__dirname, '..', 'lib', 'agent'))
  ;

describe("mocks / stubs combined with the legacy trace API", function (done) {
  /**
   * The piece of the MySQL API instrumented by the New Relic agent
   */
  var mysql = {
    Client : {
      prototype : {
        query : function (sql, callback) {
          return callback(null, []);
        }
      }
    }
  };

  it("should capture the transaction calls fired during a MySQL trace", function (done) {
    sinon.test(function () {
      /*
       * The methods used by the transaction-tracing API for this call
       */
      var transactionAPI = {
        push : function () {},
        pop  : function () {}
      };

      /*
       * Sinon setup
       */
      var stubGetTransaction = this.stub();
      stubGetTransaction.returns(transactionAPI);

      var stubAgent = {
        getTransaction : stubGetTransaction
      };

      /*
       * The important part: the actual transaction API call expectations.
       */
      var mockTransaction = this.mock(transactionAPI);
      mockTransaction.expects('push').once().returns(true);
      mockTransaction.expects('pop').once();

      /*
       * Drive the instrumentation by calling the instrumented method.
       */
      mysqlInstrument(stubAgent, trace, mysql);
      mysql.Client.prototype.query('SELECT * FROM test_table', function (error, data) {
        mockTransaction.verify();

        return done();
      });
    }).bind(this)(); // <-- note -- sinon.test sandboxes are functions to be invoked
  });

  it("should capture the tracer calls fired during a MySQL trace", function (done) {
    sinon.test(function() {
      var agent = new Agent();
      var transaction = agent.createTransaction();
      var statement = new database.ParsedStatement('select', 'test_table');
      // passing in a function ripped from its originating object is a confusing
      // use of closures / continuations
      var tracer = trace.createTracer(agent, statement.recordMetrics);

      /*
       * Sinon setup
       */
      var mockTrace = this.mock(trace);
      var mockTracer = this.mock(tracer);

      /*
       * The important part: the actual transaction API call expectations.
       */
      mockTracer.expects('finish').once();
      mockTrace.expects('createTracer').once().returns(tracer);

      /*
       * Drive the instrumentation by calling the instrumented method.
       */
      mysqlInstrument(agent, trace, mysql);
      mysql.Client.prototype.query('SELECT * FROM test_table', function (error, data) {
        mockTrace.verify();
        mockTracer.verify();

        return done();
      });
    }).bind(this)(); // <-- note -- sinon.test sandboxes are functions to be invoked
  });

  // TODO: add another test that sets up a parent for the transaction trace
});
