require('babel-register');
var _ = require('lodash');

// require('./lib/fetch.js').then(metadata => {
//   console.log(Object.keys(metadata));
// });

var makeDep = function (constraint) {
  return {
    constraint: constraint,
    arch: 'arch'
  };
};

var packages = {
  a: [
    {packageName: 'a', version: '1.0.0', dependencies: {}},
    {packageName: 'a', version: '2.0.0', dependencies: {}},
  ],
  b: [
    {packageName: 'b', version: '1.0.0', dependencies: {a: makeDep('1.0.0')}},
    {packageName: 'b', version: '2.0.0', dependencies: {a: makeDep('2.0.0')}}
  ],
  c: [
    {packageName: 'c', version: '1.0.0', dependencies: {a: makeDep('1.0.0')}},
  ]
};

const catalog = {
  getSortedVersionRecords: function(packageName) {
    return packages;
  },
  getVersion: function(packageName, version) {
    return _.find(packages[packageName], function(d) { return d.version === version; });
  }
};

var PackagesResolver = require('./lib/constraint-solver');
var r = new PackagesResolver(catalog, {});
console.log(r.resolve(['a', 'b', 'c'], [], {}));
