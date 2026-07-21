'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'خطایی رخ داد | Apple333';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main role="alert" className="p-8">
      <h1>خطایی رخ داد</h1>
      <button onClick={reset}>تلاش دوباره</button>
    </main>
  );
}
