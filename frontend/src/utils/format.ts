import { format } from 'date-fns';

export const displayName = (email: string): string => {
  const local = (email || '').split('@')[0];
  if (!local) return email || 'Unknown';
  const pretty = local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
  return pretty || email;
};

export const badgeTime = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : format(d, 'EEE h:mm:ss a');
};

export const headerTime = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : format(d, 'MMM d, h:mm a');
};
