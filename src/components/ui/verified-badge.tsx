import React from 'react';

export function VerifiedBadge({ className = "h-3.5 w-3.5 inline-block align-middle ml-1" }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 align-middle ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      title="Verified Account"
    >
      <circle cx="12" cy="12" r="10" fill="#0095F6" />
      <path
        d="M8.5 12.5L10.8 14.8L15.5 9.5"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function isProfileVerified(profile?: {
  is_guest?: boolean | null;
  auth_user_id?: string | null;
} | null): boolean {
  if (!profile) return false;
  if (profile.is_guest === true) return false;
  if (profile.auth_user_id || profile.is_guest === false) return true;
  return false;
}
