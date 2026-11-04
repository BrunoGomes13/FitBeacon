import fullLight from '../../assets/brand/logo-fitbeacon-claro.png';
import symbolLight from '../../assets/brand/simbolo-fitbeacon-claro.png';
import splashLight from '../../assets/brand/splash-logo-claro-1024.png';
import fullDark from '../../assets/brand/logo-fitbeacon-transparente.png';
import symbolDark from '../../assets/brand/simbolo-fitbeacon-transparente.png';
import splashDark from '../../assets/brand/splash-logo-1024.png';
import type { ThemeMode } from '../theme';
import { selectThemeAsset } from './selectThemeAsset';

export function getBrandAssets(mode: ThemeMode) {
  return {
    full: selectThemeAsset(mode, fullLight, fullDark),
    symbol: selectThemeAsset(mode, symbolLight, symbolDark),
    splash: selectThemeAsset(mode, splashLight, splashDark),
  };
}
