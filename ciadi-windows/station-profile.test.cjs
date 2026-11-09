const test = require('node:test');
const assert = require('node:assert/strict');
const { STATION_PROFILES, getStationProfile } = require('./station-profile.cjs');

test('recognizes the four station profiles', () => {
  assert.equal(getStationProfile('[Station]\nprofile=adm').key, 'adm');
  assert.equal(getStationProfile('[Station]\nprofile=suporte').key, 'suporte');
  assert.equal(getStationProfile('[Station]\nprofile=rh').key, 'rh');
  assert.equal(getStationProfile('[Station]\nprofile=rececao').key, 'rececao');
  assert.equal(Object.keys(STATION_PROFILES).length, 4);
});

test('does not assign a station for missing or unknown values', () => {
  assert.equal(getStationProfile('[Station]'), null);
  assert.equal(getStationProfile('[Station]\nprofile=superuser'), null);
  assert.equal(getStationProfile(''), null);
});
