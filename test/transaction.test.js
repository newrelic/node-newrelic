var path        = require('path')
  , chai        = require('chai')
  , should      = chai.should()
  , expect      = chai.expect
  , transaction = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

describe("transaction management", function () {
  // don't add Sinon into the mix until I know what to spy on
  var agent = {name : "test application"};

  afterEach(function () {
    transaction.reset();
  });

  it("must have every transaction associated with an application", function () {
    expect(function () { transaction.create(); }).throws(/must be scoped to an application/);
  });

  it("should create new transactions on demand", function () {
    should.exist(transaction.create(agent));
  });

  it("should be able to deal with multiple active transactions", function () {
    var first  = transaction.create(agent);
    var second = transaction.create(agent);

    first.should.not.equal(second);
    transaction.active(agent).length.should.equal(2);
  });

  it("should only show active transactions per application on the active list", function () {
    var first  = transaction.create(agent);
    var second = transaction.create(agent);
    var third  = transaction.create(agent);

    transaction.active(agent).length.should.equal(3);
    first.end();
    second.end();
    transaction.active(agent).length.should.equal(1);
  });

  it("should scope the transaction to the agent", function () {
    var tt = transaction.create(agent);
    tt.end();

    should.exist(tt.application);
    tt.application.should.equal(agent);
  });

  it("should allow counting the number of transactions by application", function () {
    var firstApp    = {name : 'first'};
    var firstFirst  = transaction.create(firstApp);
    var secondFirst = transaction.create(firstApp);
    var thirdFirst  = transaction.create(firstApp);

    var secondApp    = {name : 'second'};
    var firstSecond  = transaction.create(secondApp);
    var secondSecond = transaction.create(secondApp);

    firstFirst.end();
    secondFirst.end();

    transaction.active(firstApp).length.should.equal(1);
    transaction.byApplication(firstApp).length.should.equal(3);
  });

  it("should allow the addition of traces by name", function () {
    var tt = transaction.create(agent);

    tt.measure('Custom/Test01');
    should.exist(tt.metric('Custom/Test01'));
  });

  it("shouldn't trace calls added after the transaction has finished", function () {
    var tt = transaction.create(agent);

    tt.measure('Custom/Test02');
    tt.end();

    tt.measure('Custom/Test03');
    should.not.exist(tt.metric('Custom/Test03'));
  });
});
