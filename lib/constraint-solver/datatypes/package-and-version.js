// An ordered pair of (package, version).
const PackageAndVersion = function (pkg, version) {
  // check(pkg, String);
  // check(version, String);

  this.package = pkg;
  this.version = version;
};

// The string form of a PackageAndVersion is "package version",
// for example "foo 1.0.1".  The reason we don't use an "@" is
// it would look too much like a PackageConstraint.
PackageAndVersion.prototype.toString = function () {
  return this.package + " " + this.version;
};

PackageAndVersion.fromString = function (str) {
  var parts = str.split(' ');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return new PackageAndVersion(parts[0], parts[1]);
  } else {
    throw new Error("Malformed PackageAndVersion: " + str);
  }
};

module.exports = PackageAndVersion;
