'use strict';

var path             = require('path')
  , chai             = require('chai')
  , expect           = chai.expect
  , Metric           = require(path.join(__dirname, '..', 'lib', 'metrics', 'metric'))
  , RenameRules      = require(path.join(__dirname, '..', 'lib', 'metrics', 'rename-rules'))
  ;

describe("Metric", function () {
  it("should have a name", function () {
    var metric = new Metric('Agent/Test');
    expect(metric.name).equal('Agent/Test');
  });

  it("should throw if no name is passed", function () {
    expect(function () { var metric = new Metric(); }).throws("Metrics must be named");
    expect(function () { var metric = new Metric(null, 'TEST'); }).throws("Metrics must be named");
  });

  it("should have a scope (when one is included)", function () {
    var metric = new Metric('Agent/Test', 'TEST');
    expect(metric.scope).equal('TEST');
  });

  it("should have statistics available", function () {
    var metric = new Metric('Agent/Test');
    expect(metric.stats).an('object');
  });

  it("should have have ApdexStats when created with an apdex", function () {
    var metric = new Metric('Agent/ApdexTest', null, 0.87);
    expect(metric.stats.incrementFrustrating).a('function');
  });

  it("should have have regular / non-ApdexStats when created with no apdex", function () {
    var metric = new Metric('Agent/StatsTest');
    expect(metric.stats.incrementCallCount).a('function');
  });

  it("should produce a JSON representation with a name", function () {
    var metric = new Metric('Agent/Test');
    expect(metric.toJSON()).deep.equal({name : 'Agent/Test'});
  });

  it("should stringify to a spec with a name", function () {
    var metric = new Metric('Agent/Test');
    expect(JSON.stringify(metric)).equal('{"name":"Agent/Test"}');
  });

  it("should produce a JSON representation that's just an ID if name is numeric", function () {
    var metric = new Metric(6156);
    expect(metric.toJSON()).equal(6156);
  });

  it("should stringify to a number if name is numeric", function () {
    var metric = new Metric(6156);
    expect(JSON.stringify(metric)).equal("6156");
  });

  it("should produce a JSON representation with a name & scope (when included)", function () {
    var metric = new Metric('Agent/Test', 'TEST');
    expect(metric.toJSON()).deep.equal({name : 'Agent/Test', scope : 'TEST'});
  });

  it("should stringify to a spec with a name and scope (when included)", function () {
    var metric = new Metric('Agent/Test', 'TEST');
    expect(JSON.stringify(metric)).equal('{"name":"Agent/Test","scope":"TEST"}');
  });

  describe("when serializing", function () {
    var metric
    , renamer
    ;

    describe("with ordinary statistics", function () {
      beforeEach(function () {
        metric = new Metric('Agent/DataTest384');
        expect(metric.stats.incrementCallCount).a('function');
        renamer = new RenameRules([[{name : 'Agent/DataTest384'}, 'Agent/Serialization']]);
      });

      it("should get the bare stats right", function () {
        expect(JSON.stringify(metric.toData())).equal('[{"name":"Agent/DataTest384"},[0,0,0,0,0,0]]');
      });

      it("should correctly rename metrics given rules", function () {
        expect(JSON.stringify(metric.toData(renamer))).equal('[{"name":"Agent/Serialization"},[0,0,0,0,0,0]]');
      });

      it("should correctly serialize statistics", function () {
        metric.stats.recordValue(0.2, 0.1);
        expect(JSON.stringify(metric.toData())).equal('[{"name":"Agent/DataTest384"},[1,0.2,0.1,0.2,0.2,0.04000000000000001]]');
      });
    });

    describe("with apdex statistics", function () {
      beforeEach(function () {
        metric = new Metric('Agent/DataTest385', null, 0.8);
        expect(metric.stats.incrementFrustrating).a('function');
        renamer = new RenameRules([[{name : 'Agent/DataTest385'}, 'Agent/Serialization']]);
      });

      it("should get the bare stats right", function () {
        expect(JSON.stringify(metric.toData())).equal('[{"name":"Agent/DataTest385"},[0,0,0,0.8,0.8,0]]');
      });

      it("should correctly rename metrics given rules", function () {
        expect(JSON.stringify(metric.toData(renamer))).equal('[{"name":"Agent/Serialization"},[0,0,0,0.8,0.8,0]]');
      });

      it("should correctly serialize statistics", function () {
        metric.stats.recordValueInMillis(3220);
        expect(JSON.stringify(metric.toData())).equal('[{"name":"Agent/DataTest385"},[0,0,1,0.8,0.8,0]]');
      });
    });
  });
});
