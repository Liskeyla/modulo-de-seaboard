'use client';

import { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  confirmClass?: string;
  onClose: () => void;
  onConfirm: () => void;
  children: ReactNode;
}

export function ConfirmModal({
  open,
  title,
  subtitle,
  confirmLabel = 'Confirmar',
  confirmClass = 'dms-btn-eliminar',
  onClose,
  onConfirm,
  children,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={<AlertTriangle className="h-4 w-4" />}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <button
            type="button"
            className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={cn(confirmClass, 'px-4 py-2 text-sm')}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-gray-600">{children}</div>
    </Modal>
  );
}
