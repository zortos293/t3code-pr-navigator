'use client';

import SyncToast from './SyncToast';
import type { SyncToastData } from '@/app/hooks/useSyncProgress';

type Props = {
  toasts: SyncToastData[];
};

export default function ToastContainer({ toasts }: Props) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-full flex-col gap-2">
      {toasts.slice(0, 5).map((toast) => (
        <SyncToast key={toast.id} {...toast} />
      ))}
    </div>
  );
}
