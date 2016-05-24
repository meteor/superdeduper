require('babel-register');
var fs = require('fs');
var _ = require('lodash');

// basically for testing whilst I'm on the plane
const METADATA_CACHE = './metadata.cache.json';
var promise;

var packageJsonFile = process.argv[2];
var packageJson = JSON.parse(fs.readFileSync(packageJsonFile))
const dependencies = _.keys(packageJson.dependencies);

try {
  promise = Promise.resolve(JSON.parse(fs.readFileSync(METADATA_CACHE)));
} catch (e) {
  promise = require('./lib/fetch.js')(packageJson).then(metadata => {
    fs.writeFileSync(METADATA_CACHE, JSON.stringify(metadata));
    return metadata;
  });
}

promise.then(function(metadata) {
  const catalog = {
    getSortedVersionRecords: function(packageName) {
      const versions = metadata[packageName].versions;
      return _.map(versions, function(version) {
        const dependencies = {};
        _.each(version.dependencies, function(constraint, depName) {
          dependencies[depName] = {
            constraint: constraint,
            references: [
              { arch: "os" },
              { arch: "web.browser"},
              { arch: "web.cordova"}
            ]
          }
        });
        return {
          packageName: packageName,
          version: version.version,
          dependencies: dependencies,
        };
      });
    },
    getVersion: function(packageName, version) {
      return _.find(this.getSortedVersionRecords(packageName), function(d) { return d.version === version; });
    }
  };

  var PackagesResolver = require('./lib/constraint-solver');
  var r = new PackagesResolver(catalog, {});
  try {
    console.log(r.resolve(dependencies, [], {}));
  } catch (err) {
    console.log(err);
    console.log(err.stack)
  }
});
