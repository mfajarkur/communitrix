# Communitrix Frontend & Architectural Standard Operating Procedure (SOP)

This document establishes the official architectural baseline and coding standards for **Communitrix**. All developers, AI agents, and code reviewers must strictly adhere to these guidelines to ensure maximum performance, zero unnecessary overhead, instant page loads, and seamless future scalability.

---

## 1. Data Fetching & Supabase Optimization (SOP-01)

### 1.1 Strict Ban on `select('*')`
- **Rule**: Never use `select('*')` in Supabase data fetching queries. Always explicitly specify only the exact columns required by the UI component or server action.
- **Rationale**: Fetching unused columns inflates network payload sizes, increases Supabase memory footprint, and slows down serialization/deserialization.
- **Example**:
  ```typescript
  // ❌ BAD
  const { data } = await supabase.from('members').select('*').eq('community_id', communityId);

  // ✅ GOOD
  const { data } = await supabase
    .from('members')
    .select('id, full_name, avatar_url, role, rating')
    .eq('community_id', communityId);
  ```

### 1.2 Caching & Revalidation Strategy
- **Rule**: Leverage Next.js Server Components (RSC), `React.cache()`, and tag-based revalidation (`revalidateTag`, `revalidatePath`) for server-side data fetching. Use lightweight client caching (SWR/React Query) when real-time client refetching is necessary.
- **Rationale**: Prevents redundant round-trips to Supabase for static or semi-static data (e.g., community profile, member lists, past session details).
- **Pattern**:
  - Wrap database getter functions in `React.cache()` to dedup calls during a single request lifecycle.
  - Apply incremental revalidation on mutation actions (e.g., invalidating session list cache only after a session ends).

### 1.3 Mandatory Database-Level Pagination & Infinite Scrolling
- **Rule**: All data lists (match histories, leaderboards, community activity feeds) **must** implement server-side pagination using `.range(from, to)` or limit-offset cursors directly at the query level.
- **Rationale**: Prevents loading hundreds or thousands of rows into memory at once, keeping initial payloads tiny (< 50KB).
- **Example**:
  ```typescript
  // ✅ GOOD: Paginated Leaderboard Query
  const PAGE_SIZE = 20;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from('leaderboards')
    .select('id, player_name, points, wins, losses', { count: 'exact' })
    .eq('community_id', communityId)
    .order('points', { ascending: false })
    .range(from, to);
  ```

---

## 2. Component Architecture & Rendering (SOP-02)

### 2.1 Server Components First (RSC)
- **Rule**: Default to Server Components (`React Server Components`) for all pages, layouts, and data containers. Keep `'use client'` strictly scoped to leaf components requiring state, event listeners (`onClick`, `onChange`), or browser hooks.
- **Rationale**: Reduces client JavaScript bundle size, improves Time to Interactive (TTI), and optimizes SEO / initial HTML streaming.

### 2.2 Lazy Loading & Dynamic Imports for Heavy UI
- **Rule**: Heavy UI elements, off-screen modals, image croppers, complex admin wizards, and charting tools **must** be loaded dynamically via `next/dynamic` with `ssr: false` when applicable.
- **Rationale**: Prevents interactive dialogs and crop modals from bloating the critical render path bundle.
- **Example**:
  ```typescript
  import dynamic from 'next/dynamic';

  // ✅ GOOD: Dynamic Import for Avatar Crop Modal
  const AvatarCropModal = dynamic(() => import('@/app/(app)/avatar-crop-modal'), {
    ssr: false,
    loading: () => <ModalSkeleton />,
  });
  ```

### 2.3 Modular & Reusable Component Pattern
- **Rule**: Isolate UI elements into atomic, single-responsibility components under `src/components/ui/` or dedicated feature directories. Keep component props minimal and strictly typed.

---

## 3. Asset & Bundle Size Management (SOP-03)

### 3.1 Framework-Native Image Optimization (`next/image`)
- **Rule**: Never use raw HTML `<img>` tags for user content, avatars, or community banners. Always use `next/image` with explicit `width`, `height`, `sizes`, and WebP/AVIF output formats.
- **Rationale**: Ensures automatic lazy loading, optimal responsive layout sizing, and automatic WebP image compression.
- **Example**:
  ```tsx
  import Image from 'next/image';

  // ✅ GOOD: Optimized User Avatar
  <Image
    src={profile.avatarUrl || '/default-avatar.png'}
    alt={profile.fullName}
    width={48}
    height={48}
    className="rounded-full object-cover"
    sizes="(max-width: 768px) 48px, 64px"
    loading="lazy"
  />
  ```

### 3.2 Dependency Governance & Minimal Bundle Size
- **Rule**: Do not introduce additional npm dependencies for simple utilities (e.g., date formatting, class merging, icons). Rely on native Web APIs (`Intl.DateTimeFormat`, `URL`, `FormData`) or micro-helpers.
- **Rationale**: Keeps total client JavaScript bundle small (< 100KB gzipped) for lightning-fast loads on mobile 4G/5G networks.

---

## 4. Database & Security Optimization (SOP-04)

### 4.1 Mandatory Indexing for High-Frequency Columns
- **Rule**: All foreign keys (`community_id`, `session_id`, `user_id`), slug columns (`community_slug`), status columns (`status`), and composite sort pairs (`community_id, points DESC`) must have explicit database indexes created in Supabase migrations.
- **Example Index Migration**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_sessions_community_status 
  ON sessions (community_id, status);

  CREATE INDEX IF NOT EXISTS idx_members_community_rating 
  ON community_members (community_id, rating DESC);
  ```

### 4.2 Flat & Optimized Row Level Security (RLS)
- **Rule**: Keep RLS policies flat and fast. Use indexed subqueries or security definer helper functions (`is_community_admin(user_id, community_id)`) to prevent N+1 RLS evaluations during mass read operations.

---

## 5. Summary & Checklist for Developers

Before submitting or merging any pull request:
- [ ] No `select('*')` present in Supabase queries.
- [ ] All lists implement server-side pagination (`.range()`).
- [ ] Heavy interactive modals/components are dynamically imported (`next/dynamic`).
- [ ] All images use `next/image` with defined `sizes` and lazy loading.
- [ ] New database query fields have matching database indexes.
- [ ] Bundle size remains lean with zero unneeded third-party libraries.
