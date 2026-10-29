import type { BeaconAdvertisement } from './types';

const APPLE_COMPANY_ID_LOW_BYTE = 0x4c;
const APPLE_COMPANY_ID_HIGH_BYTE = 0x00;
const IBEACON_TYPE = 0x02;
const IBEACON_LENGTH = 0x15;
const IBEACON_PAYLOAD_LENGTH = 25;

const base64Values = new Map(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    .split('')
    .map((character, index) => [character, index]),
);

function decodeBase64(value: string): Uint8Array | null {
  const compact = value.trim();

  if (
    compact.length === 0 ||
    compact.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(compact) ||
    (compact.includes('=') && compact.length % 4 !== 0)
  ) {
    return null;
  }

  const bytes: number[] = [];
  let accumulator = 0;
  let bitsInAccumulator = 0;

  for (const character of compact) {
    if (character === '=') {
      break;
    }

    const sextet = base64Values.get(character);

    if (sextet === undefined) {
      return null;
    }

    accumulator = (accumulator << 6) | sextet;
    bitsInAccumulator += 6;

    if (bitsInAccumulator >= 8) {
      bitsInAccumulator -= 8;
      bytes.push((accumulator >> bitsInAccumulator) & 0xff);
      accumulator &= (1 << bitsInAccumulator) - 1;
    }
  }

  return Uint8Array.from(bytes);
}

export function normalizeBeaconUuid(value: string): string | null {
  const compact = value.replaceAll('-', '').toLowerCase();

  if (!/^[0-9a-f]{32}$/.test(compact)) {
    return null;
  }

  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join('-');
}

export function parseIBeaconManufacturerData(
  manufacturerData: string | null | undefined,
  expectedUuid?: string,
): BeaconAdvertisement | null {
  if (typeof manufacturerData !== 'string') {
    return null;
  }

  const bytes = decodeBase64(manufacturerData);

  if (
    !bytes ||
    bytes.length < IBEACON_PAYLOAD_LENGTH ||
    bytes[0] !== APPLE_COMPANY_ID_LOW_BYTE ||
    bytes[1] !== APPLE_COMPANY_ID_HIGH_BYTE ||
    bytes[2] !== IBEACON_TYPE ||
    bytes[3] !== IBEACON_LENGTH
  ) {
    return null;
  }

  let uuidHex = '';

  for (let index = 4; index < 20; index += 1) {
    uuidHex += bytes[index].toString(16).padStart(2, '0');
  }

  const uuid = normalizeBeaconUuid(uuidHex);
  const expected = expectedUuid ? normalizeBeaconUuid(expectedUuid) : null;

  if (!uuid || (expectedUuid !== undefined && (!expected || uuid !== expected))) {
    return null;
  }

  const major = bytes[20] * 256 + bytes[21];
  const minor = bytes[22] * 256 + bytes[23];
  const txPower = bytes[24] > 127 ? bytes[24] - 256 : bytes[24];

  return {
    key: `${uuid}:${major}:${minor}`,
    uuid,
    major,
    minor,
    txPower,
  };
}
