require("babel-register");

require('./lib/fetch.js').then(metadata => {
  console.log(Object.keys(metadata));
});
