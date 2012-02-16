var os = require('os');

var settings = [];
function addSetting(name, value) {
    settings.push([name, value]);
}

addSetting("Processors", os.cpus().length);
addSetting("OS", os.type());
addSetting("OS version", os.release());
addSetting("Arch", process.arch);

exports.toJSON = function() {
    return settings;
};

exports.setFramework = function(framework) {
    addSetting("Framework", framework);
};

exports.setDispatcher = function(dispatcher) {
    addSetting("Dispatcher", dispatcher);
};