const mocha = require('mocha');
const describe = mocha.describe;
const it = mocha.it;
const assert = require('chai').assert;
const _ = require('lodash');

const PV = require('../package-version-parser/package-version.js');
const Dependency = require('./dependency.js');

describe('constraint solver', function() {
  describe('datatypes', function() {
    describe('Dependency', function() {
      it('works', function() {
        _.each(["foo", "foo@1.0.0"], function (foo) {
          var d1 = new Dependency(PV.parsePackageConstraint(foo));
          assert.equal(d1.packageConstraint.toString(), foo);
          assert.equal(d1.isWeak, false);

          var d1 = new Dependency(foo);
          assert.equal(d1.packageConstraint.toString(), foo);
          assert.equal(d1.isWeak, false);

          var d2 = new Dependency(foo, { isWeak: false });
          assert.equal(d2.packageConstraint.toString(), foo);
          assert.equal(d2.isWeak, false);

          var d3 = new Dependency(foo, { isWeak: true });
          assert.equal(d3.packageConstraint.toString(), foo);
          assert.equal(d3.isWeak, true);

          var d4 = Dependency.fromString('?'+foo);
          assert.equal(d4.packageConstraint.toString(), foo);
          assert.equal(d4.isWeak, true);

          var d5 = Dependency.fromString(foo);
          assert.equal(d5.packageConstraint.toString(), foo);
          assert.equal(d5.isWeak, false);
        });

        assert.throws(function () {
          Dependency.fromString('?');
        });

        // Doesn't throw because we've commented out checks
        // assert.throws(function () {
        //   new Dependency("foo", "1.0.0");
        // });
      });
    });
  });
});
