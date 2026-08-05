// Shared across a Server Component (src/app/(app)/c/page.tsx, reads it) and a Client Component
// (community-tabs.tsx, writes it) — kept in one place so the two can't drift apart.
export const LAST_COMMUNITY_COOKIE = 'communitrix_last_community';
