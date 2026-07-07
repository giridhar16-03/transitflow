import React from 'react';

export function IconBus(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="3" y="5" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7.5" cy="18.5" r="1.2" fill="currentColor" />
      <circle cx="16.5" cy="18.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function IconMapPin(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 21s8-5.5 8-11a8 8 0 10-16 0c0 5.5 8 11 8 11z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="12" cy="10" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function IconTransitFlowLogo(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 8v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const icons = { bus: IconBus, pin: IconMapPin, logo: IconTransitFlowLogo };
export default icons;
