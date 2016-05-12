module.exports = function (message) {
  var e = new Error(message);
  e.constraintSolverError = true;
  throw e;
};
