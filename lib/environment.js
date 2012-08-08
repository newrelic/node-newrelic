'use strict';

var os = require('os');

var settings = [];

function addSetting(name, value) {
  settings.push([name, value]);
}

addSetting("Processors", os.cpus().length);
addSetting("OS",         os.type());
addSetting("OS version", os.release());
addSetting("Arch",       process.arch);

module.exports = {
  toJSON : function () {
    return settings;
  },

  setFramework : function (framework) {
    addSetting("Framework", framework);
  },

  setDispatcher : function (dispatcher) {
    addSetting("Dispatcher", dispatcher);
  }
};
