export function LiftIcon() {
  return (
    <svg width="22" height="20" viewBox="-14 -13 28 26" fill="none" aria-hidden="true">
      {/* Angled cable */}
      <line x1="-13" y1="-5" x2="13" y2="-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Grip clamp */}
      <rect x="-3" y="-11" width="6" height="3" rx="1" fill="currentColor" />
      {/* V hangers */}
      <line x1="-1.5" y1="-8" x2="-5" y2="-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1.5" y1="-8" x2="5" y2="-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Top deck */}
      <rect x="-8" y="-3" width="16" height="3" stroke="currentColor" strokeWidth="1.5" />
      {/* Cabin */}
      <rect x="-8" y="0" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      {/* Left window */}
      <rect x="-7" y="2" width="5" height="7" rx="1" stroke="currentColor" strokeWidth="1" strokeOpacity="0.6" />
      {/* Right window */}
      <rect x="2" y="2" width="5" height="7" rx="1" stroke="currentColor" strokeWidth="1" strokeOpacity="0.6" />
    </svg>
  );
}

export function SlopeIcon() {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true">
      {/* mountain */}
      <path d="M2 16 L10 3 L18 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />
      {/* piste line */}
      <path d="M10 3 L14.5 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LayersIcon() {
  return (
    <svg width="22" height="20" viewBox="0 0 24 20" fill="none" aria-hidden="true">
      <line x1="3" y1="4" x2="21" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="16" x2="21" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="4" r="2.5" fill="#07111f" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="10" r="2.5" fill="#07111f" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="11" cy="16" r="2.5" fill="#07111f" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function GastronomyMapIcon() {
  return (
    <svg width="22" height="20" viewBox="-11 -10 22 20" fill="none" aria-hidden="true">
      {/* Fork tines */}
      <line x1="-4.5" y1="-8" x2="-4.5" y2="-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-2.5" y1="-8" x2="-2.5" y2="-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-0.5" y1="-8" x2="-0.5" y2="-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Fork arch */}
      <path d="M-4.5,-3 Q-2.5,-1 -0.5,-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Fork handle */}
      <line x1="-2.5" y1="-1.5" x2="-2.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Knife blade */}
      <path d="M2.5,-8 L4,-4 L2.5,-2.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Knife handle */}
      <line x1="2.5" y1="-2.5" x2="2.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function WebcamMapIcon() {
  return (
    <svg width="22" height="20" viewBox="-11 -10 22 20" fill="none" aria-hidden="true">
      {/* Camera body */}
      <rect x="-9" y="-5" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      {/* Lens */}
      <circle cx="0" cy="0.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Viewfinder bump */}
      <rect x="-4" y="-8" width="5" height="3" rx="1" fill="currentColor" />
    </svg>
  );
}

export function InfrastructureMapIcon() {
  return (
    <svg width="22" height="20" viewBox="-11 -10 22 20" fill="none" aria-hidden="true">
      {/* Map pin outline */}
      <path d="M0,-9 C-5,-9 -7,-5 -7,-2 C-7,3 0,9 0,9 C0,9 7,3 7,-2 C7,-5 5,-9 0,-9 Z" stroke="currentColor" strokeWidth="1.5" />
      {/* Inner circle */}
      <circle cx="0" cy="-2" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function SportFunMapIcon() {
  return (
    <svg width="22" height="20" viewBox="-11 -10 22 20" fill="none" aria-hidden="true">
      <polygon
        points="0,-9 7.8,-4.5 7.8,4.5 0,9 -7.8,4.5 -7.8,-4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <polygon points="-3,-4 6,0 -3,4" fill="currentColor" opacity="0.8" />
    </svg>
  );
}
