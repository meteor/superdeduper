const _ = require('lodash');
const npm = require('npm');

const packageMetadata = {};

// let's run this on our own package.json
var toFetch = Object.keys(require('../package.json').dependencies);
console.log(toFetch);

var metadataPromise = new Promise((resolve) => {
  npm.load({}, (err, npm) => {
    const fetchPackageMetadata = require('npm/lib/fetch-package-metadata.js');

    const doFetch = () => {
      while (toFetch.length) {
        // set up closure to bind pkgName
        (pkgName => {
          if (packageMetadata[pkgName]) {
            // either downloading or downloaded. Skip
            return;
          }

          packageMetadata[pkgName] = 'pending';

          fetchPackageMetadata(pkgName, (err, pkg) => {
            console.log(`fetched ${pkgName}`)
            packageMetadata[pkgName] = pkg;

            toFetch = toFetch.concat(Object.keys(pkg.dependencies || {}));
          });
        })(toFetch.pop());
      }

      if (_.some(packageMetadata, value => value === 'pending')) {
        console.log('waiting')
        setTimeout(doFetch, 1000)
      } else {
        resolve(packageMetadata);
      }
    }

    doFetch();
  });
});



module.exports = metadataPromise;
