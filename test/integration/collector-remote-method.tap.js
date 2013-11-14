'use strict';

var path = require('path');
var test = require('tap').test;

test("DataSender (callback style) talking to fake collector", function (t) {
  var RemoteMethod = require(path.join(__dirname, '..', '..', 'lib',
                                      'collector', 'remote-method.js'));
  var collector = require(path.join(__dirname, '..', 'lib', 'fake-collector.js'));

  var config = {
    host        : 'collector.lvh.me',
    port        : 8765,
    run_id      : 1337,
    license_key : 'whatever',
    version     : '0'
  };
  var method = new RemoteMethod('get_redirect_host', config);

  var suite = this;
  collector({port : 8765}, function (error, server) {
    if (error) {
      t.fail(error);
      return t.end();
    }

    suite.tearDown(function () {
      server.close();
    });

    method._post('[]', function (error, results, json) {
      if (error) {
        t.fail(error);
        return t.end();
      }

      t.equal(results, 'collector-1.lvh.me:8080', 'parsed result should come through');
      t.notOk(json.validations, "fake collector should find no irregularities");
      t.equal(json.return_value, 'collector-1.lvh.me:8080',
              "collector returns expected collector redirect");

      t.end();
    });
  });
});
