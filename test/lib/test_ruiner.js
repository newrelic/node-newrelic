'use strict';

var path     = require('path')
  , fs       = require('fs')
  , spawn    = require('child_process').spawn
  , async    = require('async')
  , tap      = require('tap')
  , recreate = require(path.join(__dirname, 'recreate'))
  ;

module.exports = function (info, done) {
  recreate(info.prefix, 'tap');

  fs.readdir(info.prefix, function (error, files) {
    if (error) return done(error);

    async.forEachSeries(
      files.filter(function (name) { return name.match(/\.tap\.js$/); }),
      function (tapfile, callback) {
        var filepath = path.join(info.prefix, tapfile)
          , ruiner   = spawn('node', [filepath])
          , consumer = tap.createConsumer()
          , busted   = 0
          , tests    = 0
          ;

        consumer.on('data', function (data) {
          if (data.ok === true) {
            tests++;
            return;
          }
          else if (data.ok === false) {
            tests++;
            busted++;
            // console.dir(data);
          }
          else {
            // console.log(data);
          }
        });

        ruiner.stdout.pipe(consumer);
        ruiner.on('close', function () {
          console.log("%s %s: %s failures (out of %s asserts)",
                      info.name, info.version,
                      busted, tests);
          callback();
        });
      },
      done
    );
  });
};
