import React from 'react';
import { cn } from '@/lib/utils';

type StatusType =
  | 'active' | 'used' | 'blocked'
  | 'unpaid' | 'pending_verification' | 'paid_verified' | 'paid_rejected' | 'paid_manual_verified'
  | 'draft' | 'registrations_open' | 'registrations_closed' | 'live' | 'ended'
  | 'verified' | 'rejected' | 'needs_manual_review'
  | 'super_admin' | 'admin' | 'counter_staff';

const statusConfig: Record<StatusType, { label: string; className: string; isLive?: boolean }> = {
  // Ticket status
  active:                { label: 'Active',          className: 'badge-active' },
  used:                  { label: 'Checked In',       className: 'badge-verified' },
  blocked:               { label: 'Blocked',          className: 'badge-rejected' },
  // Payment status
  unpaid:                { label: 'Unpaid',           className: 'badge-rejected' },
  pending_verification:  { label: 'Pending',          className: 'badge-pending' },
  paid_verified:         { label: 'Paid ✓',           className: 'badge-active' },
  paid_rejected:         { label: 'Rejected',         className: 'badge-rejected' },
  paid_manual_verified:  { label: 'Manual Verified',  className: 'badge-verified' },
  // Match status
  draft:                 { label: 'Draft',            className: 'badge-draft' },
  registrations_open:    { label: 'Open',             className: 'badge-active' },
  registrations_closed:  { label: 'Closed',           className: 'badge-pending' },
  live:                  { label: 'Live',             className: 'badge-active', isLive: true },
  ended:                 { label: 'Ended',            className: 'badge-draft' },
  // AI verdict
  verified:              { label: 'Verified',         className: 'badge-active' },
  rejected:              { label: 'Rejected',         className: 'badge-rejected' },
  needs_manual_review:   { label: 'Manual Review',    className: 'badge-pending' },
  // Admin roles
  super_admin:           { label: 'Super Admin',      className: 'badge-verified' },
  admin:                 { label: 'Admin',            className: 'badge-active' },
  counter_staff:         { label: 'Counter Staff',    className: 'badge-pending' },
};

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status as StatusType] ?? { label: status, className: 'badge-draft', isLive: false };
  return (
    <span
      className={cn(
        'inline-flex items-center font-display font-semibold',
        config.className,
        className,
      )}
    >
      {config.isLive && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse mr-1.5 inline-block shrink-0" />
      )}
      {config.label}
    </span>
  );
};
