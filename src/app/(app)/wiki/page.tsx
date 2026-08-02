import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import WikiContent from './wiki-content';

export default function WikiPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <Link
        href="/communities"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-orange-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to My Profile
      </Link>
      <WikiContent />
    </div>
  );
}
