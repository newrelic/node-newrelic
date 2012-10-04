'use strict';

var Sequelize = require('sequelize');

module.exports = function setup(options, imports, register) {
  var client = new Sequelize(options.db.name, options.db.user);
  var api = {
    sequelizeDAL : {
      sequelize : client,
      Sequelize : Sequelize
    }
  };

  return register(null, api);
};
