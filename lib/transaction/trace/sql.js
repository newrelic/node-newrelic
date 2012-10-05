'use strict';

var path  = require('path')
  , codec = require(path.join(__dirname, '..', '..', 'util', 'codec'))
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
 * Because encoding is asynchronous, this must also be asynchronous.
 *
 * Thank goodness for events!
 *
 * @param {string} name FIXME: only need to come up with a path at
 *                      generation time for some reason.
 * @param {object} params The parameters for the query, if any.
 * @param {Function} callback After generation, hand off the results.
 *                            First parameter is errors, second is
 *                            JSON-ready array.
 */
SQLTrace.prototype.generateJSON = function (name, params, callback) {
  codec.encode(params, function (err, encoded) {
    if (err) return callback(err);

    return callback(null,
                    [
                      name,
                      this.transaction.url,
                      this.getSQLId(),
                      this.query,
                      this.stats.callCount,
                      this.stats.total,
                      this.stats.min,
                      this.stats.max,
                      encoded
                    ]);
  }.bind(this));
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
