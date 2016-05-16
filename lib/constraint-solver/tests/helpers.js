const _ = require('lodash')
const PV = require('../package-version-parser/package-version.js');

// Take a map of `{ dependency: constraint }`, where `dependency`
// is a package name string and `constraint` is a constraint string,
// and return an array of dependencies (package name strings)
// and an array of constraint objects.
//
// If a constraint is prefixed with 'w', the dependency is a weak
// dependency, so it will generate a constraint but not a dependency
// in the returned arrays.
module.exports.splitArgs = function (deps) {
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
