'use strict';

var path = require('path')
  , sinon = require('sinon')
  , mysqlInstrument = require(path.join(__dirname, '..', 'lib', 'instrumentation', 'mysql'))
  , trace = require(path.join(__dirname, '..', 'lib', 'trace'))
  ;

describe("mocked transaction trace", function (done) {
  it("should capture the API calls fired during a MySQL trace", function (done) {
    /*
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
    var stubGetTransaction = sinon.stub();
    stubGetTransaction.returns(transactionAPI);

    var stubAgent = {
      getTransaction : stubGetTransaction
    };

    /*
     * The important part: the actual transaction API call expectations.
     */
    var mockTransaction = sinon.mock(transactionAPI);
    mockTransaction.expects('push').once().returns(true);
    mockTransaction.expects('pop').once();

    mysqlInstrument.initialize(stubAgent, trace, mysql);

    /*
     * Drive the instrumentation by calling the instrumented method.
     */
    mysql.Client.prototype.query('SELECT * FROM test_table', function (error, data) {
      mockTransaction.verify();

      return done();
    });
  });

  // TODO: add another test that sets up a parent for the transaction trace
});
