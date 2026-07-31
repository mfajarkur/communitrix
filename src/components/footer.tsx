import { APP_VERSION } from '@/lib/version';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full py-4 text-center text-[11px] text-zinc-400 select-none">
      <p>communitrix.id © {year}</p>
      <p>version {APP_VERSION}</p>
    </footer>
  );
}
