function Trace() {
  var start = Date.now()
    , finish
    ;

    this.end = function () {
      finish = Date.now();
    };
}

function Transaction(application) {
  var active = true
    , start  = Date.now()
    , traces = {}
    , finish
    ;

  if (!application) throw new Error('every transaction must be scoped to an application');

  this.application = application;

  this.end = function () {
    finish = Date.now();
    active = false;
  };

  this.isActive = function () {
    return active;
  };

  this.measure = function (name) {
    if (!active) return;

    traces[name] = new Trace();
  };

  this.metric = function (name) {
    return traces[name];
  };
}

var transactions = {};

exports.create = function (application) {
  var blank = new Transaction(application);

  if (!transactions[application.name]) transactions[application.name] = [];
  transactions[application.name].push(blank);

  return blank;
};

exports.byApplication = function (application) {
  return transactions[application.name];
};

exports.active = function (application) {
  return transactions[application.name].filter(function (transaction) { return transaction.isActive(); });
};

/**
 * Used for testing
 */
exports.reset = function () {
  Object.keys(transactions).forEach(function (key) {
    transactions[key].forEach(function (transaction, index) { transaction.end(); });
  });
  transactions = {};
};
