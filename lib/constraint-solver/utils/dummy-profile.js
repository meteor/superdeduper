// Implements the Profile interface (as we use it) but doesn't do
// anything.
const DummyProfile = function (bucket, f) {
  return f;
};
DummyProfile.time = function (bucket, f) {
  return f();
};

module.exports = DummyProfile;
