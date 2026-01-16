
import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = "h-8 w-8" }) => {
  return (
    <div className={`${className} relative flex items-center justify-center`}>
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Shield Background */}
        <path 
          d="M50 5L15 20V45C15 65.5 30 84.5 50 95C70 84.5 85 65.5 85 45V20L50 5Z" 
          fill="url(#logo-gradient)" 
          fillOpacity="0.1"
          stroke="url(#logo-gradient)" 
          strokeWidth="2"
        />
        
        {/* Drone Frame */}
        <path d="M25 25L75 75" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
        <path d="M75 25L25 75" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
        
        {/* Rotors */}
        <circle cx="25" cy="25" r="8" stroke="url(#logo-gradient)" strokeWidth="2" fill="black" />
        <circle cx="75" cy="25" r="8" stroke="url(#logo-gradient)" strokeWidth="2" fill="black" />
        <circle cx="25" cy="75" r="8" stroke="url(#logo-gradient)" strokeWidth="2" fill="black" />
        <circle cx="75" cy="75" r="8" stroke="url(#logo-gradient)" strokeWidth="2" fill="black" />
        
        {/* Central AI Lens */}
        <circle cx="50" cy="45" r="12" fill="black" stroke="url(#logo-gradient)" strokeWidth="3" />
        <circle cx="50" cy="45" r="5" fill="url(#logo-gradient)">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
        </circle>

        <defs>
          <linearGradient id="logo-gradient" x1="0" y1="0" x2="100" y2="100">
            <stop offset="0%" stopColor="#00f2ff" />
            <stop offset="100%" stopColor="#0066ff" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default Logo;
