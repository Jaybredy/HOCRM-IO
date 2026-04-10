/**
 * AccessGuard - wraps UI sections to conditionally render based on capability.
 *
 * Usage:
 *   <AccessGuard can={can} capability={CAPABILITIES.RECORD_CREATE} propertyId={selectedPropertyId}>
 *     <Button>Add Record</Button>
 *   </AccessGuard>
 */

export default function AccessGuard({ can, capability, propertyId, fallback = null, children }) {
  if (!can(capability, propertyId)) return fallback;
  return children;
}