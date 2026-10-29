import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { parseIBeaconManufacturerData } from '../src/beacon/ibeacon.ts';

const sampleHex = '4C000215B9407F30F5F8466EAFF925556B57FE6D00010003C5';
const expectedUuid = 'b9407f30-f5f8-466e-aff9-25556b57fe6d';

function toBase64(hex) {
  return Buffer.from(hex, 'hex').toString('base64');
}

test('parses the Apple iBeacon manufacturer payload and signed TX power', () => {
  assert.deepEqual(parseIBeaconManufacturerData(toBase64(sampleHex)), {
    key: `${expectedUuid}:1:3`,
    uuid: expectedUuid,
    major: 1,
    minor: 3,
    txPower: -59,
  });
});

test('returns null for truncated payloads and malformed base64', () => {
  assert.equal(parseIBeaconManufacturerData(toBase64(sampleHex.slice(0, -2))), null);
  assert.equal(parseIBeaconManufacturerData('!not-base64!'), null);
  assert.equal(parseIBeaconManufacturerData(null), null);
});

test('rejects payloads from other manufacturers', () => {
  const otherManufacturer = `5000${sampleHex.slice(4)}`;
  assert.equal(parseIBeaconManufacturerData(toBase64(otherManufacturer)), null);
});

test('filters a valid iBeacon UUID that does not match the requested gym', () => {
  assert.equal(
    parseIBeaconManufacturerData(
      toBase64(sampleHex),
      '00000000-0000-0000-0000-000000000001',
    ),
    null,
  );
});
