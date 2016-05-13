const _ = require('lodash')
const mocha = require('mocha');
const describe = mocha.describe;
const it = mocha.it;
const assert = require('chai').assert;

const PV = require('../package-version-parser/package-version.js');
const PackagesResolver = require('..');
const Input = require('../datatypes/input.js');
const CatalogCache = require('../catalog/catalog-cache.js');

var makeResolver = function (data) {
  var Versions = {};

  _.each(data, function (versionDescription) {
    var packageName = versionDescription.shift();
    var version = versionDescription.shift();
    var deps = versionDescription.shift();

    var constructedDeps = {};
    _.each(deps, function (constraint, name) {
      constructedDeps[name] = {
        constraint: constraint,
        references: [
          { arch: "os" },
          { arch: "web.browser"},
          { arch: "web.cordova"}
        ]
      };
    });
    Versions[packageName] = Versions[packageName] || [];
    Versions[packageName].push({
      packageName: packageName,
      version: version,
      dependencies: constructedDeps
    });
  });

  var catalogStub = {
    getSortedVersionRecords: function (name) {
      var records = Versions[name];
      records.sort(function (a, b) {
        return PV.compare(a.version, b.version);
      });
      return records;
    }
  };
  return new PackagesResolver(catalogStub);
};

var defaultResolver = makeResolver([
  ["sparky-forms", "1.1.2", {"forms": "=1.0.1", "sparkle": "=2.1.1"}],
  ["sparky-forms", "1.0.0", {"awesome-dropdown": "=1.4.0"}],
  ["forms", "1.0.1", {"sparkle": "2.1.0", "jquery-widgets": "1.0.0"}],
  ["sparkle", "2.1.0", {"jquery": "1.8.2"}],
  ["sparkle", "2.1.1", {"jquery": "1.8.2"}],
  ["sparkle", "1.0.0"],
  ["awesome-dropdown", "1.4.0", {"dropdown": "=1.2.2"}],
  ["awesome-dropdown", "1.5.0", {"dropdown": "=1.2.2"}],
  ["dropdown", "1.2.2", {"jquery-widgets": "1.0.0"}],
  ["jquery-widgets", "1.0.0", {"jquery": "1.8.0", "sparkle": "2.1.1"}],
  ["jquery-widgets", "1.0.2", {"jquery": "1.8.0", "sparkle": "2.1.1"}],
  ["jquery", "1.8.0"],
  ["jquery", "1.8.2"]
]);

// Take a map of `{ dependency: constraint }`, where `dependency`
// is a package name string and `constraint` is a constraint string,
// and return an array of dependencies (package name strings)
// and an array of constraint objects.
//
// If a constraint is prefixed with 'w', the dependency is a weak
// dependency, so it will generate a constraint but not a dependency
// in the returned arrays.
const splitArgs = function (deps) {
  var dependencies = [], constraints = [];

  _.each(deps, function (constr, dep) {
    if (constr && constr.charAt(0) === 'w') {
      constr = constr.slice(1);
    } else {
      dependencies.push(dep);
    }
    if (constr) {
      constraints.push(PV.parsePackageConstraint(dep + "@" + constr));
    }
  });
  return {dependencies: dependencies, constraints: constraints};
};

var testWithResolver = function (resolver, f) {
  var answerToString = function (answer) {
    var pvs = _.map(answer, function (v, p) { return p + ' ' + v; });
    return pvs.sort().join('\n');
  };
  var t = function (deps, expected, options) {
    var dependencies = splitArgs(deps).dependencies;
    var constraints = splitArgs(deps).constraints;

    var resolvedDeps = resolver.resolve(dependencies, constraints, options);
    assert.equal(answerToString(resolvedDeps.answer),
               answerToString(expected));
  };

  var FAIL = function (deps, regexp) {
    assert.throws(function () {
      var dependencies = splitArgs(deps).dependencies;
      var constraints = splitArgs(deps).constraints;

      var resolvedDeps = resolver.resolve(dependencies, constraints);
    }, regexp);
  };
  f(t, FAIL);
};


describe("constraint-solver", function() {
  it("simple exact + regular deps", function () {
    testWithResolver(defaultResolver, function (t) {
      t({ "sparky-forms": "=1.1.2" }, {
        "sparky-forms": "1.1.2",
        "forms": "1.0.1",
        "sparkle": "2.1.1",
        "jquery-widgets": "1.0.2",
        "jquery": "1.8.2"
      });

      t({ "sparky-forms": "=1.1.2", "awesome-dropdown": "=1.5.0" }, {
        "sparky-forms": "1.1.2",
        "forms": "1.0.1",
        "sparkle": "2.1.1",
        "jquery-widgets": "1.0.2",
        "jquery": "1.8.2",
        "awesome-dropdown": "1.5.0",
        "dropdown": "1.2.2"
      });
    });
  });


  it("non-exact direct dependency", function () {
    testWithResolver(defaultResolver, function (t) {
      // sparky-forms 1.0.0 won't be chosen because it depends on a very old
      // jquery, which is not compatible with the jquery that
      // awesome-dropdown uses.
      t({ "sparky-forms": "1.0.0", "awesome-dropdown": "=1.5.0" }, {
        "sparky-forms": "1.1.2",
        "forms": "1.0.1",
        "sparkle": "2.1.1",
        "jquery-widgets": "1.0.2",
        "jquery": "1.8.2",
        "awesome-dropdown": "1.5.0",
        "dropdown": "1.2.2"
      });
    });
  });

  it("no results", function () {
    var resolver = makeResolver([
      ["bad-1", "1.0.0", {indirect: "1.0.0"}],
      ["bad-2", "1.0.0", {indirect: "2.0.0"}],
      ["indirect", "1.0.0"],
      ["indirect", "2.0.0"],
      ["mytoplevel", "1.0.0", {"bad-1": "1.0.0", "bad-2": ""}]
    ]);
    testWithResolver(resolver, function (t, FAIL) {
      FAIL({ "mytoplevel": "" }, function (error) {
        return error.message.match(/indirect@2\.0\.0 is not satisfied by indirect 1\.0\.0/)
          && error.message.match(/^\* indirect@1\.0\.0 <- bad-1 1\.0\.0 <- mytoplevel 1.0.0$/m)
          && error.message.match(/^\* indirect@2\.0\.0 <- bad-2 1\.0\.0 <- mytoplevel 1.0.0$/m)
        // Lines should be unique.
          && ! error.message.match(/bad-1[^]+bad-1/)
        // only two constraints listed
          && ! error.message.match(/onstraints on package "foo":[^]+@[^]+@[^]+@/);
      });
    });

    resolver = makeResolver([
      ["foo", "1.0.0"],
      ["foo", "1.1.0"],
      ["foo", "2.0.0"],
      ["foo", "2.1.0"],
      ["bar", "1.0.0", {foo: "1.0.0"}]
    ]);
    testWithResolver(resolver, function (t, FAIL) {
      FAIL({foo: "2.0.0", bar: "1.0.0"}, function (error) {
        return error.message.match(/Constraints on package "foo":[^]+top level/) &&
          error.message.match(/Constraints on package "foo":[^]+bar 1.0.0/);
      });
    });

    testWithResolver(makeResolver([]), function (t, FAIL) {
      FAIL({foo: "1.0.0"}, /unknown package in top-level dependencies: foo/);
    });

    resolver = makeResolver([
      ["foo", "2.0.0"],
      ["bar", "1.0.0", {foo: ""}]
    ]);
    testWithResolver(resolver, function (t, FAIL) {
      FAIL({foo: "w1.0.0", bar: "1.0.0"},
           /No version of foo satisfies all constraints: @1.0.0/);
    });
  });


  it("any-of constraint", function () {
    var resolver = makeResolver([
      ["one-of", "1.0.0", {indirect: "1.0.0 || 2.0.0"}],
      ["important", "1.0.0", {indirect: "2.0.0"}],
      ["indirect", "1.0.0"],
      ["indirect", "2.0.0"]
    ]);

    testWithResolver(resolver, function (t, FAIL) {
      t({ "one-of": "=1.0.0", "important": "1.0.0" }, {
        "one-of": "1.0.0",
        "important": "1.0.0",
        "indirect": "2.0.0"
      });
    });

    resolver = makeResolver([
      ["one-of", "1.0.0", {indirect: "1.0.0 || 2.0.0"}],
      ["one-of-equal", "1.0.0", {indirect: "1.0.0 || =2.0.1"}],
      ["important", "1.0.0", {indirect: "1.0.0"}],
      ["indirect", "1.0.0"],
      ["indirect", "2.0.0"],
      ["indirect", "2.0.1"]
    ]);

    testWithResolver(resolver, function (t, FAIL) {
      t({ "one-of": "=1.0.0", "important": "1.0.0" }, {
        "one-of": "1.0.0",
        "important": "1.0.0",
        "indirect": "1.0.0"
      });

      t({ "one-of-equal": "1.0.0", "indirect": "2.0.0" }, {
        "one-of-equal": "1.0.0",
        "indirect": "2.0.1"
      });

      t({ "one-of-equal": "1.0.0", "one-of": "1.0.0" }, {
        "one-of-equal": "1.0.0",
        "one-of": "1.0.0",
        "indirect": "1.0.0"
      });

      FAIL({"one-of-equal": "1.0.0",
            "one-of": "1.0.0",
            "indirect" : "=2.0.0"}, function (error) {
              return error.message.match(/Constraints on package "indirect":[^]+top level/) &&
                error.message.match(/Constraints on package "indirect":[^]+one-of-equal 1.0.0/);
            });
    });
  });

  it("previousSolution", function () {
    testWithResolver(defaultResolver, function (t, FAIL) {
      // This is what you get if you lock sparky-forms to 1.0.0.
      t({ "sparky-forms": "=1.0.0" }, {
        "sparky-forms": "1.0.0",
        "awesome-dropdown": "1.4.0",
        "dropdown": "1.2.2",
        "jquery-widgets": "1.0.2",
        "jquery": "1.8.2",
        "sparkle": "2.1.1"
      });

      // If you just requires something compatible with 1.0.0, we end up choosing
      // 1.1.2.
      t({ "sparky-forms": "1.0.0" }, {
        "sparky-forms": "1.1.2",
        "forms": "1.0.1",
        "sparkle": "2.1.1",
        "jquery-widgets": "1.0.2",
        "jquery": "1.8.2"
      });

      // But if you ask for something compatible with 1.0.0 and have a previous
      // solution with 1.0.0, the previous solution works (since it is achievable).
      t({ "sparky-forms": "1.0.0" }, {
        "sparky-forms": "1.0.0",
        "awesome-dropdown": "1.4.0",
        "dropdown": "1.2.2",
        "jquery-widgets": "1.0.2",
        "jquery": "1.8.2",
        "sparkle": "2.1.1"
      }, { previousSolution: {
        "sparky-forms": "1.0.0"
      }});

      // On the other hand, if the previous solution is incompatible with the
      // constraints, it's not an error: we can try something that isn't the
      // previous solution in this case!
      t({ "sparky-forms": "1.1.2" }, {
        "sparky-forms": "1.1.2",
        "forms": "1.0.1",
        "sparkle": "2.1.1",
        "jquery-widgets": "1.0.2",
        "jquery": "1.8.2"
      }, { previousSolution: {
        "sparky-forms": "1.0.0"
      }});
    });
  });

  describe("no constraint dependency", function() {
    it(" - anything", function () {
      var versions = defaultResolver.resolve(["sparkle"], []).answer;
      assert.isTrue(_.isString(versions.sparkle));
    });

    it("transitive dep still picked right", function () {
      var versions = defaultResolver.resolve(
        ["sparkle", "sparky-forms"],
        [PV.parsePackageConstraint("sparky-forms@1.1.2")]).answer;
      assert.equal(versions.sparkle, "2.1.1");
    });
  });


  it("input serialization", function () {
    var json = '{"dependencies":["sparky-forms"],"constraints":["sparky-forms@1.0.0"],"catalogCache":{"data":{"sparky-forms 1.0.0":["awesome-dropdown@=1.4.0"],"sparky-forms 1.1.2":["forms@=1.0.1","sparkle@=2.1.1"],"sparkle 1.0.0":[],"sparkle 2.1.0":["jquery@1.8.2"],"sparkle 2.1.1":["jquery@1.8.2"],"jquery 1.8.0":[],"jquery 1.8.2":[],"forms 1.0.1":["sparkle@2.1.0","jquery-widgets@1.0.0"],"jquery-widgets 1.0.0":["jquery@1.8.0","sparkle@2.1.1"],"jquery-widgets 1.0.2":["jquery@1.8.0","sparkle@2.1.1"],"awesome-dropdown 1.4.0":["dropdown@=1.2.2"],"awesome-dropdown 1.5.0":["dropdown@=1.2.2"],"dropdown 1.2.2":["jquery-widgets@1.0.0"]}}}';

    var input1 = Input.fromJSONable(JSON.parse(json));

    assert.equal(input1.dependencies, ["sparky-forms"]);
    assert.isTrue(input1.constraints[0] instanceof PV.PackageConstraint);
    assert.equal(input1.constraints.toString(), "sparky-forms@1.0.0");
    assert.isTrue(input1.catalogCache instanceof CatalogCache);
    assert.equal(input1.upgrade, []);
    assert.equal(input1.anticipatedPrereleases, {});
    assert.equal(input1.previousSolution, null);
    assert.equal(input1.allowIncompatibleUpdate, false);
    assert.equal(input1.upgradeIndirectDepPatchVersions, false);

    var obj1 = input1.toJSONable();
    assert.isFalse(_.has(obj1, 'upgrade'));
    assert.isFalse(_.has(obj1, 'anticipatedPrereleases'));
    assert.isFalse(_.has(obj1, 'previousSolution'));
    var input2 = Input.fromJSONable(obj1);
    var obj2 = input2.toJSONable();

    assert.equal(JSON.stringify(obj1), json);
    assert.equal(JSON.stringify(obj2), json);

    ///// Now a different case:

    var input2 = new Input(
      ['foo'], [PV.parsePackageConstraint('foo@1.0.0')],
      new CatalogCache(), {
        upgrade: ['foo'],
        anticipatedPrereleases: { foo: { '1.0.0-rc.0': true } },
        previousSolution: { foo: '1.0.0' },
        allowIncompatibleUpdate: true,
        upgradeIndirectDepPatchVersions: true
      });

    var json2 = JSON.stringify(input2.toJSONable());
    var input2prime = Input.fromJSONable(JSON.parse(json2));
    assert.equal(input2prime.toJSONable(), {
      dependencies: ["foo"],
      constraints: ["foo@1.0.0"],
      catalogCache: { data: {} },
      upgrade: ['foo'],
      anticipatedPrereleases: { foo: { '1.0.0-rc.0': true } },
      previousSolution: { foo: '1.0.0' },
      allowIncompatibleUpdate: true,
      upgradeIndirectDepPatchVersions: true
    });
  });

  it("non-existent indirect package", function () {
    var resolver = makeResolver([
      ["foo", "1.0.0", {bar: "1.0.0"}]
    ]);
    testWithResolver(resolver, function (t, FAIL) {
      FAIL({ "foo": "1.0.0" }, function (error) {
        return error.message.match(/unknown package: bar/);
      });
    });
  });
});
