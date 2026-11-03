import fullLogo from '../assets/brand/logo-fitbeacon-transparente.png';
import symbol from '../assets/brand/simbolo-fitbeacon-transparente.png';

export function FullBrand({ className = '' }: { className?: string }) {
  return (
    <div className={`brand-panel ${className}`}>
      <img alt="FitBeacon — tecnologia que te guia no seu treino" src={fullLogo} />
    </div>
  );
}

export function BrandLockup({ className = '' }: { className?: string }) {
  return (
    <span aria-label="FitBeacon" className={`brand-lockup ${className}`}>
      <img alt="" aria-hidden="true" src={symbol} />
      <span className="brand-wordmark"><span>Fit</span><strong>Beacon</strong></span>
    </span>
  );
}
