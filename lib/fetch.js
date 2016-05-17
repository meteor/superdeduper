const _ = require('lodash');
const npm = require('npm');

const packageMetadata = {};

// let's run this on our own package.json
var toFetch = Object.keys(require('../package.json').dependencies);

var metadataPromise = new Promise((resolve) => {
  npm.load({}, (err, npm) => {
    const fetchPackageMetadata = require('npm/lib/fetch-package-metadata.js');
    const mapToRegistry = require('npm/lib/utils/map-to-registry.js');

    const doFetch = () => {
      while (toFetch.length) {
        // set up closure to bind pkgName
        (pkgName => {
          if (packageMetadata[pkgName]) {
            // either downloading or downloaded. Skip
            return;
          }

          packageMetadata[pkgName] = 'pending';

          // Code lifted from https://github.com/npm/npm/blob/master/lib/fetch-package-metadata.js#L105-L112
          //   although they fetch all versions they don't have an API to do so
          mapToRegistry(pkgName, npm.config, (err, url, auth) => {
            npm.registry.get(url, {auth: auth}, (err, data) => {
              console.log(`fetched ${pkgName}`)

              packageMetadata[pkgName] = data;
              Object.keys(data.versions || {}).forEach(version => {
                toFetch = toFetch.concat(Object.keys(data.versions[version].dependencies || {}));
              });
            });
          });

          // XXX: use this to fetch from github etc
          // fetchPackageMetadata(pkgName, (err, pkg) => {
          //   console.log(`fetched ${pkgName}`)
          //   packageMetadata[pkgName] = pkg;
          //
          //   toFetch = toFetch.concat(Object.keys(pkg.dependencies || {}));
          // });
        })(toFetch.pop());
      }

      if (_.some(packageMetadata, value => value === 'pending')) {
        setTimeout(doFetch, 1000)
      } else {
        resolve(packageMetadata);
      }
    }

    doFetch();
  });
});

module.exports = metadataPromise;
