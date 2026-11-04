import fullLogoLight from '../assets/brand/logo-fitbeacon-claro.png';
import symbolLight from '../assets/brand/simbolo-fitbeacon-claro.png';
import fullLogoDark from '../assets/brand/logo-fitbeacon-transparente.png';
import symbolDark from '../assets/brand/simbolo-fitbeacon-transparente.png';
import { useAppTheme } from '../design/ThemeProvider';
import { selectThemeAsset } from '../design/theme';

export function FullBrand({ className = '' }: { className?: string }) {
  const { mode } = useAppTheme();
  return (
    <div className={`brand-panel ${className}`}>
      <img
        alt="FitBeacon — tecnologia que te guia no seu treino"
        src={selectThemeAsset(mode, fullLogoLight, fullLogoDark)}
      />
    </div>
  );
}

export function BrandLockup({ className = '' }: { className?: string }) {
  const { mode } = useAppTheme();
  return (
    <span aria-label="FitBeacon" className={`brand-lockup ${className}`}>
      <img
        alt=""
        aria-hidden="true"
        src={selectThemeAsset(mode, symbolLight, symbolDark)}
      />
      <span className="brand-wordmark"><span>Fit</span><strong>Beacon</strong></span>
    </span>
  );
}
