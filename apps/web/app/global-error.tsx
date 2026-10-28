'use client'; // Error boundaries must be Client Components

import './globals.css';

// Last resort, when the root layout itself fails: no translations are available here, so both
// languages are shown. Must render its own <html> and <body>.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="vi">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center font-sans">
        <title>ReTix</title>
        <p className="text-lg font-semibold text-slate-900">Đã có lỗi xảy ra · Something went wrong</p>
        <button
          type="button"
          onClick={() => retry()}
          className="h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white"
        >
          Thử lại · Try again
        </button>
      </body>
    </html>
  );
}
