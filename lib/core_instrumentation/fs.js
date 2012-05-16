var path    = require('path')
  , shimmer =  require(path.join(__dirname, '..', 'shimmer'))
  ;

exports.initialize = function (agent, trace, fs) {
  var readdir = shimmer.preserveMethod(fs, 'readdir');

  fs.readdir = function (path, callback) {
    var tx = agent.getTransaction();
    if (!tx) return readdir(path, callback);

    var tracer = new trace.Tracer(tx, 'Filesystem/ReadDir/' + path);
    return readdir(path, function () {
      tracer.finish();

      callback.apply(this, arguments);
    });
  };
};
