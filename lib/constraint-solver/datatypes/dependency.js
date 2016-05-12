// A Dependency consists of a PackageConstraint (like "foo@=1.2.3")
// and flags, like "isWeak".

const PV = require('../package-version-parser/package-version.js');


const Dependency = function (packageConstraint, flags) {
  if (typeof packageConstraint !== 'string') {
    // this `if` is because Match.OneOf is really, really slow when it fails
    // check(packageConstraint, Match.OneOf(PV.PackageConstraint, String));
  }
  if (typeof packageConstraint === 'string') {
    packageConstraint = PV.parsePackageConstraint(packageConstraint);
  }
  if (flags) {
    // check(flags, Object);
  }

  this.packageConstraint = packageConstraint;
  this.isWeak = false;

  if (flags) {
    if (flags.isWeak) {
      this.isWeak = true;
    }
  }
};

// The string form of a Dependency is `?foo@1.0.0` for a weak
// reference to package "foo" with VersionConstraint "1.0.0".
Dependency.prototype.toString = function () {
  var ret = this.packageConstraint.toString();
  if (this.isWeak) {
    ret = '?' + ret;
  }
  return ret;
};

Dependency.fromString = function (str) {
  var isWeak = false;

  if (str.charAt(0) === '?') {
    isWeak = true;
    str = str.slice(1);
  }

  var flags = isWeak ? { isWeak: true } : null;

  return new Dependency(str, flags);
};

module.exports = Dependency;
