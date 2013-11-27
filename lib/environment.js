'use strict';

var path = require('path')
  , fs   = require('fs')
  , os   = require('os')
  ;

var exists = fs.existsSync || path.existsSync;

/**
 * true if and only if path exists and is a directory
 * should now throw
 */
function existsDir(dirPath) {
  if (!exists(dirPath)) return false;

  var stat = fs.statSync(dirPath);
  if (stat) return stat.isDirectory();

  return false;
}

var remapping = {
  node_install_npm    : "npm installed?",
  node_install_waf    : "WAF build system installed?",
  node_use_openssl    : "OpenSSL support?",
  node_shared_openssl : "Dynamically linked to OpenSSL?",
  node_shared_v8      : "Dynamically linked to V8?",
  node_shared_zlib    : "Dynamically linked to Zlib?",
  node_use_dtrace     : "DTrace support?",
  node_use_etw        : "Event Tracing for Windows (ETW) support?"
};

var settings = [];

function getSetting(name) {
  var items = settings.filter(function (candidate) {
    return candidate[0] === name;
  }).map(function (setting) {
    return setting[1];
  });

  return items;
}

/**
 * Add a setting to the module's shared settings object.
 *
 * @param string name
 * @param string value
 */
function addSetting(name, value) {
  if (getSetting(name).indexOf(value) === -1) settings.push([name, value]);
}

/**
 * Remove settings with the given name.
 *
 * @param {string} name
 */
function clearSetting(name) {
  settings = settings.filter(function (candidate) {
    return candidate[0] !== name;
  });
}

/**
 * Build up a list of top-level packages available to an application relative
 * to the provided root.
 *
 * @param string root Where to start.
 * @return array List of packages.
 */
function listPackages(root) {
  var packages = [];
  if (existsDir(root)) {
    packages = fs.readdirSync(root)
      .filter(function (entry) {
        var candidate = path.resolve(root, entry);
        return fs.statSync(candidate).isDirectory() &&
               exists(path.resolve(candidate, 'package.json'));
      })
      .map(function (dir) {
        var pck = path.resolve(root, dir, 'package.json');
        var version = JSON.parse(fs.readFileSync(pck)).version || '<unknown>';
        return [dir, version];
      });
  }

  return packages;
}

/**
 * Build up a list of dependencies from a given node_module root.
 *
 * @param string root Where to start.
 * @return array List of dependencies.
 */
function listDependencies(root) {
  var children = [];
  if (existsDir(root)) {
    fs.readdirSync(root)
      .filter(function (entry) {
        var candidate = path.resolve(root, entry);
        return fs.statSync(candidate).isDirectory();
      })
      .forEach(function (entry) {
        var candidate = path.resolve(root, entry, 'node_modules');
        if (exists(candidate)) {
          children = children.concat(listPackages(candidate));
          children = children.concat(listDependencies(candidate));
        }
      });
  }

  return children;
}

/**
 * Build up a list of packages, starting from the current directory.
 *
 * @param string start Root directory to start generation from.
 * @returns object Two lists, of packages and dependencies, with the
 *                 appropriate names.
 */
function getLocalPackages(start) {
  var packages     = []
    , dependencies = []
    , candidate    = start
    ;

  while (candidate) {
    var root = path.resolve(candidate, 'node_modules');
    packages = packages.concat(listPackages(root));
    dependencies = dependencies.concat(listDependencies(root));

    var last = candidate;
    candidate = path.dirname(candidate);
    if (last === candidate) break;
  }

  return {packages : packages, dependencies : dependencies};
}

/**
 * Generic method for getting packages and dependencies relative to a
 * provided root directory.
 *
 * @param string root Where to start looking -- doesn't add node_modules.
 * @returns object Two lists, of packages and dependencies, with the
 *                 appropriate names.
 */
function getPackages(root) {
  var packages     = []
    , dependencies = []
    ;

  if (exists(root)) {
    packages = listPackages(root);
    dependencies = listDependencies(root);
  }

  return {packages : packages, dependencies : dependencies};
}

/**
 * Generate a list of globally-installed packages, if available / accessible
 * via the environment.
 *
 * @returns object Two lists, of packages and dependencies, with the
 *                 appropriate names.
 */
function getGlobalPackages() {
  var packages     = []
    , dependencies = []
    ;

  if (process.config && process.config.variables) {
    var prefix = process.config.variables.node_prefix;
    if (prefix) {
      var root = path.resolve(prefix, 'lib', 'node_modules');
      return getPackages(root);
    }
  }

  return {packages : packages, dependencies : dependencies};
}

/**
 * Take a list of packages and reduce it to a list of pairs serialized
 * to JSON (to simplify things on the collector end) where each
 * package appears at most once, with all the versions joined into a
 * comma-delimited list.
 *
 * @returns Array Sorted list of [name, version] pairs.
 */
function flattenVersions(packages) {
  var info = Object.create(null);
  packages.forEach(function (pair) {
    var p = pair[0]
      , v = pair[1]
      ;

    if (info[p]) {
      if (info[p].indexOf(v) < 0) info[p].push(v);
    }
    else {
      info[p] = [v];
    }
  });

  return Object.keys(info)
               .map(function (key) {
                 return [key, info[key].join(', ')];
               })
               .sort()
               .map(function (pair) {
                 return JSON.stringify(pair);
               });
}

/**
 * There are a bunch of settings generated at build time that are useful to
 * know for troubleshooting purposes. These settings are only available in 0.7
 * and up.
 *
 * This function works entirely via side effects using the
 * addSetting function.
 */
function remapConfigSettings() {
  if (process.config && process.config.variables) {
    var variables = process.config.variables;
    Object.keys(variables).forEach(function (key) {
      if (remapping[key]) {
        var value = variables[key];

        if (value === true  || value === 1) value = 'yes';
        if (value === false || value === 0) value = 'no';

        addSetting(remapping[key], value);
      }
    });
  }
}

/**
 * Scrape the list of packages, following the algorithm as described in the
 * node module page:
 *
 * http://nodejs.org/docs/latest/api/modules.html
 *
 * This function works entirely via side effects using the addSetting
 * function.
 */
function findPackages() {
  var local   = getLocalPackages(process.cwd())
    , all     = getGlobalPackages()
    , other   = {packages : [], dependencies : []}
    ;

  if (process.env.NODE_PATH) {
    var paths;
    if (process.platform === 'win32') { // why. WHY.
      paths = process.env.NODE_PATH.split(';');
    }
    else {
      paths = process.env.NODE_PATH.split(':');
    }

    paths.forEach(function (nodePath) {
      if (nodePath[0] !== '/') nodePath = path.resolve(process.cwd(), nodePath);
      var nextSet = getPackages(nodePath);
      other.packages = other.packages.concat(nextSet.packages);
      other.dependencies = other.dependencies.concat(nextSet.dependencies);
    });
  }

  var packages = local.packages.concat(
    all.packages,
    other.packages
  );

  var dependencies = local.dependencies.concat(
    all.dependencies,
    other.dependencies
  );

  var home
    , homeOld
    ;

  if (process.platform === 'win32') {
    if (process.env.USERDIR) {
      home    = getPackages(path.resolve(process.env.USERDIR, '.node_modules'));
      homeOld = getPackages(path.resolve(process.env.USERDIR, '.node_libraries'));
    }
  }
  else {
    if (process.env.HOME) {
      home    = getPackages(path.resolve(process.env.HOME, '.node_modules'));
      homeOld = getPackages(path.resolve(process.env.HOME, '.node_libraries'));
    }
  }

  if (home) {
    packages.unshift(home.packages);
    dependencies.unshift(home.dependencies);
  }

  if (homeOld) {
    packages.unshift(homeOld.packages);
    dependencies.unshift(homeOld.dependencies);
  }

  addSetting('Packages', flattenVersions(packages));
  addSetting('Dependencies', flattenVersions(dependencies));
}

// hi Nuno
function badOS() {
  var badVersion = false;

  if (!process.versions) {
    badVersion = true;
  }
  else {
    var version = process.versions.node.split('.');
    if (version[1] <= 8 && version[2] <= 5) badVersion = true;
  }

  return badVersion &&
         os.arch() === 'x64' &&
         os.type() === 'SunOS';
}

/**
 * Settings actually get scraped below.
 */

// in 64-bit SmartOS zones, node <= 0.8.5 pukes on os.cpus()
if (!badOS()) addSetting('Processors', os.cpus().length);

addSetting('OS',              os.type());
addSetting('OS version',      os.release());
addSetting('Node.js version', process.version);
addSetting('Architecture',    process.arch);

remapConfigSettings();
findPackages();

module.exports = {
  setFramework    : function (framework) { addSetting('Framework', framework); },
  setDispatcher   : function (dispatcher) { addSetting('Dispatcher', dispatcher); },
  clearFramework  : function () { clearSetting('Framework'); },
  clearDispatcher : function () { clearSetting('Dispatcher'); },
  toJSON          : function () { return settings; },
  get             : getSetting
};
