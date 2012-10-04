'use strict';

var mongoose = require('mongoose');

module.exports = function setup(options, imports, register) {
  var db = mongoose.createConnection('localhost', options.db.name);
  var api = {
    mongooseDAL : {
      db       : db,
      mongoose : mongoose
    }
  };

  return register(null, api);
};
