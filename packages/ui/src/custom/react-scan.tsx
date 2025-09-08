'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const isDevelopment = process.env.NODE_ENV === 'development';

export function ReactScan(): null {
  const pathParams = useSearchParams();
  const enabled = pathParams.get('react-scan') === 'true';

  useEffect(() => {
    if (enabled && isDevelopment) {
      // Add a small delay to ensure React DevTools has initialized
      const timeoutId = setTimeout(() => {
        // Check if React DevTools is already active to avoid conflicts
        const hasReactDevTools = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.on;

        if (!hasReactDevTools) {
          import('react-scan')
            .then(({ scan }) => {
              scan({
                enabled,
              });
            })
            .catch((error) => {
              console.warn('Failed to load react-scan:', error);
            });
        } else {
          console.warn(
            'React DevTools detected. Skipping react-scan to avoid conflicts.',
          );
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [enabled]);

  return null;
}
