'use client';

import { useState, useEffect } from 'react';

export function BackendHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const port = window.location.port || '80';
    if (port === '3000' || port === '3001') {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-medium">Backend offline?</span>
      <span>
        Use o Docker e acesse{' '}
        <a href="http://localhost:3100" className="underline font-medium">
          http://localhost:3100
        </a>
        , ou inicie o backend: <code className="bg-amber-100 px-1 rounded text-xs">docker compose up -d</code>
      </span>
    </div>
  );
}
