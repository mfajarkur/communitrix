export default function Footer() {
  return (
    <footer className="w-full py-3 px-4 text-center text-[10px] sm:text-[11px] font-light text-zinc-400/80 hover:text-zinc-500 transition-colors select-none shrink-0 z-20">
      <div className="flex items-center justify-center gap-2">
        <a
          href="https://instagram.com/communitrix.id"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-orange-500 hover:underline transition-colors"
        >
          Contact Us
        </a>
        <span>•</span>
        <span>Version 1.0 © 2026 Communitrix</span>
      </div>
    </footer>
  );
}
