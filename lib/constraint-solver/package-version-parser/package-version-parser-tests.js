const mocha = require('mocha');
const describe = mocha.describe;
const it = mocha.it;
const assert = require('chai').assert;
const _ = require('lodash');

const PackageVersion = require('./package-version.js');

const assertPackageConstraint = (vc, spec) => {
  assert.instanceOf(vc, PackageVersion.PackageConstraint);
  assert.deepEqual(_.pick(vc, 'package', 'constraintString', 'versionConstraint'), spec)
};

describe('package-version-parser', function() {
  it('validatePackageName', function() {
    var badName = function (packageName, messageExpect) {
      assert.throws(function () {
        try {
          PackageVersion.validatePackageName(packageName);
        } catch (e) {
          if (! e.versionParserError) {
            assert.fail(e.message);
          }
          throw e;
        }
      }, messageExpect);
    };

    PackageVersion.validatePackageName('a');
    PackageVersion.validatePackageName('a-b');
    PackageVersion.validatePackageName('a.b');

    badName("$foo", /can only contain/);
    badName("", /must contain a lowercase/);
    badName("foo$bar", /can only contain/);
    badName("Foo", /can only contain/);
    badName("a b", /can only contain/);
    badName(".foo", /may not begin with a dot/);
    badName("foo.", /may not end with a dot/);
    badName("foo..bar", /not contain two consecutive dots/);
    badName("-x", /not begin with a hyphen/);
    badName("--x", /not begin with a hyphen/);
    badName("0.0", /must contain/);
    badName(":a", /start or end with a colon/);
    badName("a:", /start or end with a colon/);

    // these are ok
    PackageVersion.validatePackageName('x-');
    PackageVersion.validatePackageName('x--y');
    PackageVersion.validatePackageName('x--');
  });

  it('parse', function() {
    assert.isTrue(new PackageVersion("1.2.3") instanceof PackageVersion);

    var throws = function (v, re) {
      assert.throws(function () {
        new PackageVersion(v);
      }, re);
    };
    var formatPV = function (pv) {
      pv = JSON.parse(JSON.stringify(pv));
      delete pv._semverParsed;
      return (JSON.stringify(pv)
              .replace(/,(?="prerelease"|"raw")/g, ',\n')
              .replace(/,/g, ', ')
              .replace(/"(\w+)":/g, '$1: ')
              .replace("{", "{\n")
              .replace("}", "\n}"));
    };
    var equal = function (pv1, pv2) {
      assert.equal(formatPV(pv1), formatPV(pv2));
    };

    equal(new PackageVersion("1.2.3-rc.5_1+12345"), {
      major: 1, minor: 2, patch: 3,
      prerelease: ["rc", 5], wrapNum: 1, build: ["12345"],
      raw: "1.2.3-rc.5_1+12345", version: "1.2.3-rc.5_1",
      semver: "1.2.3-rc.5+12345"
    });

    equal(PackageVersion.parse("1.2.3-rc.5_1+12345"), {
      major: 1, minor: 2, patch: 3,
      prerelease: ["rc", 5], wrapNum: 1, build: ["12345"],
      raw: "1.2.3-rc.5_1+12345", version: "1.2.3-rc.5_1",
      semver: "1.2.3-rc.5+12345"
    });

    equal(new PackageVersion("1.2.3"), {
      major: 1, minor: 2, patch: 3,
      prerelease: [], wrapNum: 0, build: [],
      raw: "1.2.3", version: "1.2.3", semver: "1.2.3"
    });
    throws("1.2", /must look like semver/);
    throws("1", /must look like semver/);
    equal(new PackageVersion("1.0.0-rc.1"), {
      major: 1, minor: 0, patch: 0,
      prerelease: ["rc", 1], wrapNum: 0, build: [],
      raw: "1.0.0-rc.1", version: "1.0.0-rc.1", semver: "1.0.0-rc.1"
    });
    throws("1.0.0-.", /must look like semver/);
    throws("1.0.0-rc.", /must look like semver/);
    throws("1.0.0-01", /must look like semver/);
    equal(new PackageVersion("1.2.3-1-1"), {
      major: 1, minor: 2, patch: 3,
      prerelease: ["1-1"], wrapNum: 0, build: [],
      raw: "1.2.3-1-1", version: "1.2.3-1-1", semver: "1.2.3-1-1"
    });
    equal(new PackageVersion("1.2.3_4"), {
      major: 1, minor: 2, patch: 3,
      prerelease: [], wrapNum: 4, build: [],
      raw: "1.2.3_4", version: "1.2.3_4", semver: "1.2.3"
    });
    throws("1.2.3_4_5", /have two _/);
    throws("1.2.3_0", /must not have a leading zero/);
    throws("1.2.3_01", /must not have a leading zero/);
    throws("1.2.3_a", /must contain only digits/);
    // (prerelease must go *before* the wrap num)
    throws("1.2.3_a-rc.1", /must contain only digits/);
    equal(new PackageVersion("1.2.3-4_5"), {
      major: 1, minor: 2, patch: 3,
      prerelease: [4], wrapNum: 5, build: [],
      raw: "1.2.3-4_5", version: "1.2.3-4_5", semver: "1.2.3-4"
    });
    equal(new PackageVersion("1.2.3-rc.1_7+8.9-10.c"), {
      major: 1, minor: 2, patch: 3,
      prerelease: ["rc", 1], wrapNum: 7, build: ["8", "9-10", "c"],
      raw: "1.2.3-rc.1_7+8.9-10.c", version: "1.2.3-rc.1_7",
      semver: "1.2.3-rc.1+8.9-10.c"
    });
    throws("1.2.3+4+5", /have two \+/);
    equal(new PackageVersion("1.2.3+x"), {
      major: 1, minor: 2, patch: 3,
      prerelease: [], wrapNum: 0, build: ["x"],
      raw: "1.2.3+x", version: "1.2.3", semver: "1.2.3+x"
    });
    throws("1.2.3+x_1", /must look like semver/);
    equal(new PackageVersion("1.2.3_1+x"), {
      major: 1, minor: 2, patch: 3,
      prerelease: [], wrapNum: 1, build: ["x"],
      raw: "1.2.3_1+x", version: "1.2.3_1", semver: "1.2.3+x"
    });

    throws("v1.0.0", /must look like semver/);
  });

  describe('constraints', function() {
    it('parsePackageConstraint', function() {
      assert.isTrue(PackageVersion.parsePackageConstraint("foo") instanceof
                  PackageVersion.PackageConstraint);

      assertPackageConstraint(PackageVersion.parsePackageConstraint("foo@1.2.3"),
                 { package: "foo", constraintString: "1.2.3",
                   versionConstraint: {
                     raw: "1.2.3",
                     alternatives: [{type: "compatible-with",
                                     versionString: "1.2.3"}] } });

      assertPackageConstraint(PackageVersion.parsePackageConstraint("foo"),
                 { package: "foo", constraintString: "",
                   versionConstraint: {
                     raw: "",
                     alternatives: [{type: "any-reasonable",
                                     versionString: null}] } });

      assertPackageConstraint(PackageVersion.parsePackageConstraint("foo@1.0.0 || =2.0.0"),
                 { package: "foo", constraintString: "1.0.0 || =2.0.0",
                   versionConstraint: {
                     raw: "1.0.0 || =2.0.0",
                     alternatives: [{type: "compatible-with",
                                     versionString: "1.0.0"},
                                    {type: "exactly",
                                     versionString: "2.0.0"}] } });

      assert.deepEqual(new PackageVersion.PackageConstraint("foo@1.0.0 || =2.0.0"),
                 PackageVersion.parsePackageConstraint("foo@1.0.0 || =2.0.0"));

      assert.deepEqual(PackageVersion.parsePackageConstraint("foo", null),
                 PackageVersion.parsePackageConstraint("foo"));

      assert.deepEqual(PackageVersion.parsePackageConstraint("foo", ""),
                 PackageVersion.parsePackageConstraint("foo"));

      assert.deepEqual(PackageVersion.parsePackageConstraint("foo", "1.0.0"),
                 PackageVersion.parsePackageConstraint("foo@1.0.0"));

      assert.deepEqual(PackageVersion.parsePackageConstraint("foo", "=1.0.0"),
                 PackageVersion.parsePackageConstraint("foo@=1.0.0"));

      assert.throws(function () {
        PackageVersion.parsePackageConstraint("", "1.0.0");
      });
      assert.throws(function () {
        PackageVersion.parsePackageConstraint("foo@1.0.0", "1.0.0");
      });
      assert.throws(function () {
        PackageVersion.parsePackageConstraint("foo@", "1.0.0");
      });
      assert.throws(function () {
        PackageVersion.parsePackageConstraint("foo@");
      }, /leave off the @/);
      assert.throws(function () {
        PackageVersion.parsePackageConstraint("foo@", "");
      });
      assert.throws(function () {
        PackageVersion.parsePackageConstraint("a@b@c");
      });
      assert.throws(function () {
        PackageVersion.parsePackageConstraint("foo@||");
      }, /Invalid constraint string: \|\|/);
      assert.throws(function () {
        PackageVersion.parsePackageConstraint("foo@=||=");
      }, /Empty string is not a valid version/);

      assertPackageConstraint(new PackageVersion.PackageConstraint(
        "foo", new PackageVersion.VersionConstraint(null)),
                 { package: "foo", constraintString: "",
                   versionConstraint: {
                     raw: "",
                     alternatives: [{type: "any-reasonable",
                                     versionString: null}] } });

      assertPackageConstraint(PackageVersion.parsePackageConstraint(
        "foo", PackageVersion.parseVersionConstraint("1.0.0 || =2.0.0")),
                 { package: "foo", constraintString: "1.0.0 || =2.0.0",
                   versionConstraint: {
                     raw: "1.0.0 || =2.0.0",
                     alternatives: [{type: "compatible-with",
                                     versionString: "1.0.0"},
                                    {type: "exactly",
                                     versionString: "2.0.0"}] } });

      assert.deepEqual(PackageVersion.parseVersionConstraint(null),
                 {raw: "", alternatives: [{type: "any-reasonable",
                                           versionString: null}]});
      assert.deepEqual(PackageVersion.parseVersionConstraint(""),
                 {raw: "", alternatives: [{type: "any-reasonable",
                                           versionString: null}]});

      assert.equal(PackageVersion.parsePackageConstraint("foo").toString(),
                 "foo");
      assert.equal(PackageVersion.parsePackageConstraint("foo", null).toString(),
                 "foo");
      assert.equal(PackageVersion.parsePackageConstraint("foo@1.0.0").toString(),
                 "foo@1.0.0");
      assert.equal(PackageVersion.parsePackageConstraint(
        "foo@=1.0.0 || 2.0.0").toString(), "foo@=1.0.0 || 2.0.0");
    });

    var t = function (pConstraintString, expected, descr) {
      var constraintString = pConstraintString.replace(/^.*?(@|$)/, '');
      var versionConstraint = {
        raw: constraintString,
        alternatives: expected.alternatives
      };
      assertPackageConstraint(
        PackageVersion.parsePackageConstraint(pConstraintString),
        {
          package: expected.package,
          constraintString: constraintString,
          versionConstraint: {
            raw: constraintString,
            alternatives: expected.alternatives
          }
        },
        descr);
    };

    var FAIL = function (versionString, errorExpect) {
      assert.throws(function () {
        PackageVersion.parsePackageConstraint(versionString);
      }, errorExpect);
    };

    it('any-reasonable', function() {
      t("foo", { package: "foo", alternatives: [{
            versionString: null, type: "any-reasonable" } ]});
      t("foo-1234", { package: "foo-1234", alternatives: [{
            versionString: null, type: "any-reasonable" } ]});
      FAIL("bad_name");
    });

    it('compatible version, compatible-with', function() {
      t("foo@1.2.3", { package: "foo", alternatives: [{
            versionString: "1.2.3", type: "compatible-with" } ]});
      t("foo-1233@1.2.3", { package: "foo-1233", alternatives: [{
            versionString: "1.2.3", type: "compatible-with" } ]});
      t("foo-bar@3.2.1", { package: "foo-bar", alternatives: [{
            versionString: "3.2.1", type: "compatible-with" } ]});
      FAIL("42@0.2.0");
      FAIL("foo@1.2.3.4");
      FAIL("foo@1.4");
      FAIL("foo@1");
      FAIL("foo@");
      FAIL("foo@@");
      FAIL("foo@x.y.z");
      FAIL("foo@<1.2");
      FAIL("foo<1.2");
      FAIL("foo@1.2.3_abc");
      FAIL("foo@1.2.3+1234_1");
      FAIL("foo@1.2.3_1-rc1");
      FAIL("foo-1233@1.2.3_0", /must not have a leading zero/);
      FAIL("foo-1233@1.2.3_a", /must contain only digits/);
      FAIL("foo-1233@1.2.3_", /wrap number must follow/);
      FAIL("foo-1233@1.2.3_0123");

      t("foo@1.2.3_1", { package: "foo", alternatives: [{
           versionString: "1.2.3_1", type: "compatible-with" } ]});
      t("foo-bar@3.2.1-rc0_123", { package: "foo-bar", alternatives: [{
           versionString: "3.2.1-rc0_123", type: "compatible-with" } ]});
      t("foo-1233@1.2.3_5+1234", { package: "foo-1233", alternatives: [{
           versionString: "1.2.3_5+1234", type: "compatible-with" } ]});
      t("foo", { package: "foo", alternatives: [{
           versionString: null, type: "any-reasonable" } ]});
    });

    it('compatible version, exactly', function() {
      t("foo@=1.2.3", { package: "foo", alternatives: [
             { versionString: "1.2.3", type: "exactly" } ]});
      t("foo-bar@=3.2.1", { package: "foo-bar", alternatives: [{
          versionString: "3.2.1", type: "exactly" } ]});
      t("foo@=1.2.3_1", { package: "foo", alternatives: [{
           versionString: "1.2.3_1", type: "exactly" } ]});
      t("foo-bar@=3.2.1_34", { package: "foo-bar", alternatives: [{
           versionString: "3.2.1_34", type: "exactly" } ]});

      FAIL("42@=0.2.0");
      FAIL("foo@=1.2.3.4");
      FAIL("foo@=1.4");
      FAIL("foo@=1");
      FAIL("foo@@=");
      FAIL("foo@=@");
      FAIL("foo@=x.y.z");
      FAIL("foo@=<1.2");
      FAIL("foo@<=1.2");
      FAIL("foo<=1.2");
      FAIL("foo@=1.2.3_rc0");

      // We no longer support @>=.
      FAIL("foo@>=1.2.3");
      FAIL("foo-bar@>=3.2.1");
      FAIL("42@>=0.2.0");
      FAIL("foo@>=1.2.3.4");
      FAIL("foo@>=1.4");
      FAIL("foo@>=1");
      FAIL("foo@@>=");
      FAIL("foo@>=@");
      FAIL("foo@>=x.y.z");
      FAIL("foo@=>12.3.11");
    });


    it('or', function() {
      t("foo@1.0.0 || 2.0.0 || 3.0.0 || =4.0.0-rc1",
        { package: "foo", alternatives:
          [{ versionString: "1.0.0", type: "compatible-with"},
           { versionString: "2.0.0", type: "compatible-with"},
           { versionString: "3.0.0", type: "compatible-with"},
           { versionString: "4.0.0-rc1", type: "exactly"}]
       });
      t("foo@1.0.0|| 2.0.0||3.0.0    ||     =4.0.0-rc1",
        { package: "foo", alternatives:
          [{ versionString: "1.0.0", type: "compatible-with"},
           { versionString: "2.0.0", type: "compatible-with"},
           { versionString: "3.0.0", type: "compatible-with"},
           { versionString: "4.0.0-rc1", type: "exactly"}]
       });
      t("foo-bar@=3.2.1 || 1.0.0",
        { package: "foo-bar", alternatives:
          [{ versionString: "3.2.1", type: "exactly"},
           { versionString: "1.0.0", type: "compatible-with"}]
       });
      t("foo@=1.2.3_1 || 1.2.4",
        { package: "foo", alternatives:
          [{ versionString: "1.2.3_1", type: "exactly"},
           { versionString: "1.2.4", type: "compatible-with"}]
       });
      t("foo-bar@=3.2.1_34 || =3.2.1-rc1",
        { package: "foo-bar", alternatives:
          [{ versionString: "3.2.1_34", type: "exactly"},
           { versionString: "3.2.1-rc1", type: "exactly"}]
        });

      FAIL("foo@1.0.0 1.0.0");
      FAIL("foo@1.0.0 | 1.0.0");
      FAIL("foo || bar");
      FAIL("foo@1.0.0-rc|1.0.0");

      // This is the current implementation, but is arguably not great.
      FAIL("foo@1.0.0 "); // trailing space
    });
  });

  it('less than, compare, version magnitude', function() {
    var compare = function (v1, v2, expected) {
      if (expected === '<') {
        assert.isTrue(PackageVersion.lessThan(v1, v2));
        assert.isTrue(PackageVersion.versionMagnitude(v1) < PackageVersion.versionMagnitude(v2));
        assert.isTrue(PackageVersion.compare(v1, v2) < 0);
      } else if (expected === '=') {
        assert.isFalse(PackageVersion.lessThan(v1, v2));
        assert.isFalse(PackageVersion.lessThan(v2, v1));
        assert.isTrue(PackageVersion.versionMagnitude(v1) === PackageVersion.versionMagnitude(v2));
        assert.isTrue(PackageVersion.compare(v1, v2) === 0);
      } else if (expected === '>') {
        assert.isTrue(PackageVersion.lessThan(v2, v1));
        assert.isTrue(PackageVersion.versionMagnitude(v1) > PackageVersion.versionMagnitude(v2));
        assert.isTrue(PackageVersion.compare(v1, v2) > 0);
      } else {
        throw new Error("expected should be '<', '=' or '>'");
      }
    };

    compare("1.0.0", "1.2.0", "<");
    compare("1.0.0_50", "1.0.1", "<");
    compare("1.0.0_50", "1.2.0", "<");
    compare("1.0.0_1", "1.0.0_2", "<");
    compare("1.0.0_2", "1.0.0_10", "<"); // verify that we compare _N "wrap numbers" as numbers, not strings
    compare("1.0.0", "1.0.0_2", "<");
    compare("1.99.0_99", "3.0.0_2", "<");
    compare("1.99.0", "2.0.0", "<");
    compare("1.0.0_5", "1.0.0_2", ">");
    compare("1.0.0_99", "1.2.0", "<");
    compare("1.0.0_99", "1.0.1", "<");
    compare("1.0.0_1", "1.0.0_2", "<");
    compare("1.0.0", "1.0.0_2", "<");
    compare("1.99.0_99", "3.0.0_2", "<");

    compare("1.0.0_5", "1.0.0_2", ">");
    compare("1.0.0", "1.0.0", "=");
    compare("1.0.0_5", "1.0.0_5", "=");
    compare("1.2.0", "1.0.0", ">");
    compare("1.0.1", "1.0.0_5", ">");

    // Rule 11 from http://semver.org
    compare("0.99.99", "1.0.0-alpha.1", "<");
    compare("1.0.0-alpha", "1.0.0-alpha.1", "<");
    compare("1.0.0-alpha.1", "1.0.0-alpha.beta", "<");
    compare("1.0.0-alpha.beta", "1.0.0-beta", "<");
    compare("1.0.0-beta", "1.0.0-beta.2", "<");
    compare("1.0.0-beta.2", "1.0.0-beta.11", "<");
    compare("1.0.0-beta.11", "1.0.0-rc.1", "<");
    compare("1.0.0-rc.1", "1.0.0", "<");

    // dashes are allowed in prerelease parts
    compare("1.0.0--alpha", "1.0.0-alpha", "<");
    compare("1.0.0-a-lpha", "1.0.0-alpha", "<");
    // test single character prerelease parts
    compare("1.0.0-r.1", "1.0.0", "<");
    // test the edges of `versionMagnitude`
    compare("1.0.0-zzzzzzzzzzzz", "1.0.0", "<");
    // prerelease parts can contain digits and non-digits
    compare("1.0.0-r1", "1.0.0-rc", "<");

    // Our broken implementation of Rule 11 (see [*] above the
    // declaration of PackageVersion.versionMagnitude). Maybe one day
    // we'll fix it, in which case replace "===" with ">"
    assert.isTrue(PackageVersion.versionMagnitude("1.0.0-beta.0") ===
                PackageVersion.versionMagnitude("1.0.0-bear.0"));

  });

  it('invalid in 0.9.2', function() {
    // Note that invalidFirstFormatConstraint assumes that the initial version
    // passed in has been previously checked to be valid in 0.9.3.

    // These are invalid in 0.9.2, but valid in 0.9.3 and above.
    var invalidVersions =
      ["1.0.0_1", "1.0.0 || 2.0.0", "1.0.0-rc1_1",
       "3.4.0-rc1 || =1.0.0"];
    _.each(invalidVersions, function (v) {
      assert.isTrue(PackageVersion.invalidFirstFormatConstraint(v));
    });

    // These are all valid in 0.9.2.
    var validVersions =
      ["1.0.0", "2.0.0-rc1", "=2.5.0"];
    _.each(validVersions, function (v) {
      assert.isFalse(PackageVersion.invalidFirstFormatConstraint(v));
    });
  });

  it('sort', function() {
    var versions = ["1.0.0", "1.0.0-rc.0", "1.0.10", "1.0.2"];
    versions.sort(PackageVersion.compare);
    assert.deepEqual(versions, ["1.0.0-rc.0", "1.0.0", "1.0.2", "1.0.10"]);
  });
});
