import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(n: number) {
  return n.toFixed(2);
}

export type ToastType = 'success' | 'error' | 'info';

export interface ToastDetail {
  msg: string;
  type?: ToastType;
}

export function toast(msg: string, type: ToastType = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastDetail>('dms-toast', { detail: { msg, type } }));
}
