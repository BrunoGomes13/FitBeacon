import { Linking, PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';
import type { BeaconPermissionSnapshot } from './types';

export async function requestBeaconPermissions(): Promise<BeaconPermissionSnapshot> {
  if (Platform.OS !== 'android') {
    return {
      status: 'granted',
      locationServicesEnabled: null,
      message: null,
    };
  }

  const androidVersion = Number(Platform.Version);
  const locationServicesEnabled = await Location.hasServicesEnabledAsync();
  const permissions =
    androidVersion >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const results = await PermissionsAndroid.requestMultiple(permissions);
  const statuses = permissions.map((permission) => results[permission]);

  if (statuses.every((status) => status === PermissionsAndroid.RESULTS.GRANTED)) {
    return {
      status: 'granted',
      locationServicesEnabled,
      message:
        androidVersion <= 30 && !locationServicesEnabled
          ? 'Ative os serviços de localização do Android para procurar beacons.'
          : null,
    };
  }

  const permanentlyDenied = statuses.some(
    (status) => status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
  );

  return {
    status: permanentlyDenied ? 'denied-permanently' : 'denied',
    locationServicesEnabled,
    message: permanentlyDenied
      ? 'A permissão foi negada permanentemente. Abra as configurações do app para autorizá-la.'
      : 'Autorize o Bluetooth e a localização para procurar beacons.',
  };
}

export async function openAppSettings(): Promise<void> {
  await Linking.openSettings();
}
