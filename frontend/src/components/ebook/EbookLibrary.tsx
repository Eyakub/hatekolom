"use client";

import { BookOpen, Download, Clock, ChevronRight } from "lucide-react";

interface EbookItem {
  ebook_id: string;
  product_id: string;
  title: string;
  title_bn: string | null;
  thumbnail_url: string | null;
  author: string | null;
  pages: number | null;
  total_downloads: number;
  last_downloaded: string | null;
  granted_at: string | null;
}

interface EbookLibraryProps {
  ebooks: EbookItem[];
  onDownload: (ebookId: string) => void;
  downloading?: string | null;
}

export function EbookLibrary({
  ebooks,
  onDownload,
  downloading,
}: EbookLibraryProps) {
  if (ebooks.length === 0) {
    return (
      <div className="text-center py-16">
        <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-400 font-bn">
          কোনো ই-বুক নেই
        </h3>
        <p className="text-sm text-gray-400 font-bn mt-1">
          কোর্স কিনলে ই-বুক এখানে দেখা যাবে
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold font-bn text-gray-900">
          আমার ই-বুক সমূহ
        </h2>
        <span className="text-sm text-gray-400">{ebooks.length}টি ই-বুক</span>
      </div>

      <div className="grid gap-4">
        {ebooks.map((ebook) => (
          <div
            key={ebook.ebook_id}
            className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Thumbnail */}
            <div className="w-16 h-20 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center shrink-0">
              {ebook.thumbnail_url ? (
                <img
                  src={ebook.thumbnail_url}
                  alt={ebook.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <BookOpen className="w-8 h-8 text-primary-400" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 font-bn text-sm">
                {ebook.title_bn || ebook.title}
              </h3>
              {ebook.author && (
                <p className="text-xs text-gray-400 mt-0.5">{ebook.author}</p>
              )}

              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                {ebook.pages && <span>{ebook.pages} পৃষ্ঠা</span>}
                <span>ডাউনলোড: {ebook.total_downloads}বার</span>
                {ebook.granted_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ebook.granted_at).toLocaleDateString("bn-BD")}
                  </span>
                )}
              </div>
            </div>

            {/* Download button */}
            <button
              onClick={() => onDownload(ebook.ebook_id)}
              disabled={downloading === ebook.ebook_id}
              className={`
                shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${
                  downloading === ebook.ebook_id
                    ? "bg-gray-100 text-gray-400 cursor-wait"
                    : "bg-primary-600 text-white hover:bg-primary-700 active:scale-95"
                }
              `}
            >
              <Download className="w-4 h-4" />
              {downloading === ebook.ebook_id ? "ডাউনলোড হচ্ছে..." : "ডাউনলোড"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
