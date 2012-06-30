"use strict";

var path = require('path');

module.exports = {
  ParsedStatement : require(path.join(__dirname, 'db', 'parsed-statement')),
  parseSql        : require(path.join(__dirname, 'db', 'parse-sql'))
};
