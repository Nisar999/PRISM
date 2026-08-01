import { Navigate } from 'react-router-dom';
import { Construction } from 'lucide-react';

/**
 * Archived conflict surfaces (Registries / Models / Runtime labels).
 * Kept for deep-link redirects — not product-canon navigation.
 */
export function ArchivedRoute({
  title,
  redirectTo = '/',
}: {
  title: string;
  redirectTo?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
      <Construction className="w-12 h-12 opacity-20" />
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-sm max-w-md text-center">
        This route conflicts with the locked Product Constitution navigation and has been
        archived. Redirecting to the canonical shell…
      </p>
      <Navigate to={redirectTo} replace />
    </div>
  );
}
