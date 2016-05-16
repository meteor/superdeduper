const mocha = require('mocha');
const describe = mocha.describe;
const it = mocha.it;
const assert = require('chai').assert;
const _ = require('lodash');

const CatalogCache = require('./catalog-cache.js');
const Dependency = require('../datatypes/dependency.js');
const PackageAndVersion = require('../datatypes/package-and-version.js');

describe('constraint solver', function() {
  describe('catalog cache', function() {
    it('works', function() {
      var cache = new CatalogCache();

      // add package versions out of order; they'll be sorted
      // when retrieved with getPackageVersions or eachPackage
      // (but not eachPackageVersion).
      cache.addPackageVersion(
        'foo', '1.0.1', [new Dependency('bar@=2.0.0 || =2.0.1'),
                         new Dependency('bzzz'),
                         new Dependency('weakly1@1.0.0', {isWeak: true}),
                         new Dependency('weakly2', {isWeak: true})]);
      cache.addPackageVersion(
        'foo', '1.0.0', [new Dependency('bar@=2.0.0')]);

      assert.throws(function () {
        // can't add deps twice
        cache.addPackageVersion(
          'foo', '1.0.0', [new Dependency('blah@1.0.0')]);
      });

      // for these toJSONable tests, the order the strings in the dependency
      // arrray is not significant and may change.
      assert.deepEqual(cache.toJSONable(), {
        data: {
          'foo 1.0.0': ['bar@=2.0.0'],
          'foo 1.0.1': ['bar@=2.0.0 || =2.0.1', 'bzzz',
                        '?weakly1@1.0.0', '?weakly2']
        } });
      assert.deepEqual(CatalogCache.fromJSONable(cache.toJSONable()).toJSONable(), {
        data: {
          'foo 1.0.0': ['bar@=2.0.0'],
          'foo 1.0.1': ['bar@=2.0.0 || =2.0.1', 'bzzz',
                        '?weakly1@1.0.0', '?weakly2']
        } });

      var pvs = {};
      cache.eachPackageVersion(function (pv, deps) {
        assert.instanceOf(pv, PackageAndVersion);
        _.values(deps).forEach(d => assert.instanceOf(d, Dependency));
        pvs[pv.package+' '+pv.version] = _.keys(deps).sort();
      });
      assert.deepEqual(pvs, {'foo 1.0.0': ['bar'],
                       'foo 1.0.1': ['bar', 'bzzz', 'weakly1', 'weakly2']});

      var oneVersion = [];
      cache.eachPackageVersion(function (pv) {
        oneVersion.push(pv.toString());
        return true; // stop
      });
      assert.equal(oneVersion.length, 1); // don't know which it is

      var foos = [];
      _.each(cache.getPackageVersions('foo'), function (v) {
        var depMap = cache.getDependencyMap('foo', v);
        foos.push([v, _.map(depMap, String).sort()]);
      });
      // versions should come out sorted, just like this.
      assert.deepEqual(foos,
                 [['1.0.0', ['bar@=2.0.0']],
                  ['1.0.1', ['?weakly1@1.0.0', '?weakly2',
                             'bar@=2.0.0 || =2.0.1', 'bzzz']]]);

      assert.throws(function () {
        // package version doesn't exist
        cache.getDependencyMap('foo', '7.0.0');
      });

      var versions = [];
      cache.eachPackage(function (p, vv) {
        versions.push.apply(versions, vv);
      });
      assert.deepEqual(versions, ["1.0.0", "1.0.1"]); // sorted

      cache.addPackageVersion('bar', '1.0.0', []);
      var onePackage = [];
      cache.eachPackage(function (p) {
        assert.isTrue(p === 'foo' || p === 'bar');
        onePackage.push(p);
        return true;
      });
      assert.equal(onePackage.length, 1); // don't know which package it is
    })
  });
});
