'use strict';

var zlib = require('zlib')
  ;

function SQLTrace(query, transaction, stats) {
  if (!query) throw new Error("Can't create SQL trace without SQL!");
  if (!transaction) throw new Error("Can't create SQL trace without transaction.");
  if (!stats) throw new Error("Can't create SQL trace without statistics.");

  this.query       = query;
  this.transaction = transaction;
  this.stats       = stats;
}

/**
 * zlib works with streams, so this must be used asynchronously.
 *
 * Take in a string, and Base64 decode and then decompress it.
 *
 * @param {string} encoded The encoded parameters object.
 * @param {Function} callback The callback to take the results,
 *                            1st parameter is any errors from
 *                            decoding, 2nd parameter is the
 *                            decoded parameters object.
 */
SQLTrace.decodeParams = function (encoded, callback) {
  zlib.inflate(new Buffer(encoded, 'base64'), function (err, raw) {
    if (err) return callback(err);

    try {
      return callback(null, JSON.parse(raw));
    }
    catch (error) {
      return callback(error);
    }
  });
};

/**
 * zlib works with streams, so this must be used asynchronously.
 *
 * Take in an object literal, and compress and then Base64 encode it.
 *
 * @param {string} params The parameters object.
 * @param {Function} callback The callback to take the results,
 *                            1st parameter is any errors from
 *                            decoding, 2nd parameter is the
 *                            encoded parameters object.
 *
 */
SQLTrace.encodeParams = function (params, callback) {
  zlib.deflate(JSON.stringify(params), function (err, raw) {
    if (err) return callback(err);

    return callback(null, raw.toString('base64'));
  });
};

SQLTrace.prototype.generateTrace = function (name, params, callback) {
  var self = this;
  SQLTrace.encodeParams(params, function (err, encoded) {
    if (err) return callback(err);

    return callback(null,
                    [
                      name,
                      self.transaction.url,
                      self.getSQLId(),
                      self.query,
                      self.stats.callCount,
                      self.stats.total,
                      self.stats.min,
                      self.stats.max,
                      encoded
                    ]);
  });
};

SQLTrace.prototype.getSQLId = function () {
  var h = 0;

  var buf = new Buffer(this.query);
  var len = buf.length;
  for (var i = 0; i < len; i++) {
    h = 31 * h + buf.readUInt8(i);
    h = h & 0xFFFFFFFF;
  }
  return h;
};

module.exports = SQLTrace;
