require("babel-register");

require('./lib/fetch.js').then(metadata => {
  console.log(metadata)
});
