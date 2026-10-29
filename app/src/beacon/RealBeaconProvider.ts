import { Platform } from 'react-native';
import { getGymBeaconUuid } from './config';
import { parseIBeaconManufacturerData } from './ibeacon';
import type {
  BeaconAdapterState,
  BeaconProvider,
  BeaconProviderState,
  BeaconReading,
} from './types';

function messageForAdapterState(state: BeaconAdapterState): string | null {
  switch (state) {
    case 'poweredOff':
      return 'Ative o Bluetooth para procurar beacons.';
    case 'unauthorized':
      return 'A permissão para usar o Bluetooth foi negada.';
    case 'unsupported':
      return 'Este dispositivo não oferece suporte a Bluetooth LE.';
    case 'error':
      return 'Não foi possível consultar o estado do Bluetooth.';
    case 'unknown':
    case 'poweredOn':
      return null;
  }
}

function mapAdapterState(state: string): BeaconAdapterState {
  switch (state) {
    case 'PoweredOn':
      return 'poweredOn';
    case 'PoweredOff':
      return 'poweredOff';
    case 'Unauthorized':
      return 'unauthorized';
    case 'Unsupported':
      return 'unsupported';
    default:
      return 'unknown';
  }
}

export class RealBeaconProvider implements BeaconProvider {
  readonly kind = 'real' as const;
  private manager: import('react-native-ble-plx').BleManager | null = null;
  private stateSubscription: { remove: () => void } | null = null;
  private onReading: ((reading: BeaconReading) => void) | null = null;
  private onState: ((state: BeaconProviderState) => void) | null = null;
  private isScanning = false;
  private isStopped = true;
  private gymUuid: string | null = null;

  async start(
    onReading: (reading: BeaconReading) => void,
    onState: (state: BeaconProviderState) => void,
  ): Promise<void> {
    if (this.manager) {
      this.reportError('Encerre a busca atual antes de iniciar outra.');
      return;
    }

    this.isStopped = false;
    this.onReading = onReading;
    this.onState = onState;

    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      this.reportError('A busca por Bluetooth está disponível apenas no app móvel.');
      return;
    }

    try {
      this.gymUuid = getGymBeaconUuid();
      const { BleManager, BleErrorCode, State } = await import('react-native-ble-plx');

      if (this.isStopped) {
        return;
      }

      const manager = new BleManager();
      this.manager = manager;
      this.stateSubscription = manager.onStateChange((state) => {
        if (this.isStopped || this.manager !== manager) {
          return;
        }

        const adapterState = mapAdapterState(state);

        if (adapterState === 'poweredOn') {
          this.onState?.({ status: 'scanning' });
          void this.startScan(manager, BleErrorCode.LocationServicesDisabled);
          return;
        }

        const message = messageForAdapterState(adapterState);

        if (message) {
          if (this.isScanning) {
            this.isScanning = false;
            void manager.stopDeviceScan().catch((error: unknown) => {
              this.reportError(
                error instanceof Error
                  ? error.message
                  : 'Não foi possível interromper a busca por beacons.',
              );
            });
          }
          this.reportError(message);
        } else {
          this.onState?.({ status: 'idle' });
        }
      }, true);

      const currentState = await manager.state();

      if (this.isStopped || this.manager !== manager) {
        return;
      }

      if (currentState === State.PoweredOn) {
        this.onState?.({ status: 'scanning' });
        await this.startScan(manager, BleErrorCode.LocationServicesDisabled);
      }
    } catch (error) {
      this.reportError(
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar a busca por beacons.',
      );
    }
  }

  async stop(): Promise<void> {
    this.isStopped = true;
    this.isScanning = false;
    this.stateSubscription?.remove();
    this.stateSubscription = null;
    this.onReading = null;
    this.onState = null;
    this.gymUuid = null;

    const manager = this.manager;
    this.manager = null;

    if (manager) {
      try {
        await manager.stopDeviceScan();
      } finally {
        await manager.destroy();
      }
    }
  }

  private async startScan(
    manager: import('react-native-ble-plx').BleManager,
    locationServicesDisabledCode: number,
  ): Promise<void> {
    if (this.isStopped || this.isScanning || this.manager !== manager) {
      return;
    }

    this.isScanning = true;

    try {
      await manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
        if (error) {
          this.isScanning = false;
          this.reportError(
            error.errorCode === locationServicesDisabledCode
              ? 'Ative os serviços de localização nas configurações do Android para buscar beacons.'
              : error.message,
          );
          return;
        }

        if (!device) {
          return;
        }

        const beacon = parseIBeaconManufacturerData(
          device.manufacturerData,
          this.gymUuid ?? undefined,
        );

        if (!beacon || device.rssi === null) {
          return;
        }

        this.onReading?.({
          ...beacon,
          rssi: device.rssi,
          observedAt: Date.now(),
        });
      });
    } catch (error) {
      this.isScanning = false;
      this.reportError(
        error instanceof Error ? error.message : 'A busca por beacons foi interrompida.',
      );
    }
  }

  private reportError(message: string): void {
    this.onState?.({ status: 'error', message });
  }
}
