import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Shared empty-state for routes the user is signed in but not authorized for.
 * Used by UserManagement, AccessManagement, and Settings — keeps copy and
 * styling consistent across the admin-gated pages.
 */
export default function PermissionDenied({
  title = 'Access Denied',
  message = "You don't have permission to access this page.",
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
          <p className="text-slate-400">{message}</p>
        </div>
      </div>
    </div>
  );
}
