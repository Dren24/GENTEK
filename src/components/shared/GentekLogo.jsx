/* Custom brain icon — same path used in GentekMark and favicon.svg */
export function BrainIcon({ size = 24, color = 'white', faceColor = '#0D9488' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Left lobe */}
      <path
        fill={color}
        d="M50 14
           C46 10 40 9 35 12
           C31 8  24 8  20 13
           C15 18 15 26 18 32
           C14 35 12 41 15 47
           C18 53 25 56 31 55
           L31 65
           L50 65
           Z"
      />
      {/* Right lobe */}
      <path
        fill={color}
        d="M50 14
           C54 10 60 9  65 12
           C69 8  76 8  80 13
           C85 18 85 26 82 32
           C86 35 88 41 85 47
           C82 53 75 56 69 55
           L69 65
           L50 65
           Z"
      />
      {/* Bottom base */}
      <rect x="31" y="63" width="38" height="10" rx="5" fill={color} />

      {/* Face — left eye */}
      <circle cx="33" cy="40" r="4.5" fill={faceColor} />
      {/* Face — right eye */}
      <circle cx="67" cy="40" r="4.5" fill={faceColor} />
      {/* Face — smile */}
      <path
        d="M38 52 Q50 62 62 52"
        stroke={faceColor}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export function GentekMark({ size = 36, className = '' }) {
  const radius = Math.round(size * 0.28)
  const iconSize = Math.round(size * 0.62)
  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center bg-brand-600 ${className}`}
      style={{ width: size, height: size, minWidth: size, borderRadius: radius }}
      aria-hidden="true"
    >
      <BrainIcon size={iconSize} color="white" />
    </div>
  )
}

export function GentekWordmark({ size = 36, textSize = 'text-lg', className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <GentekMark size={size} />
      <span className={`font-extrabold tracking-tight text-gray-900 dark:text-white ${textSize}`}>
        GEN<span className="text-brand-600">TEK</span>
      </span>
    </div>
  )
}

export default GentekMark
