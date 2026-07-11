'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { FilePicker } from '@/components/ui/file-picker';
import { Toast } from '@/components/ui/toast';

type UploadEnvelope = {
  success: boolean;
  error?: { code: string; message: string };
};

async function uploadFile(file: File): Promise<void> {
  const body = new FormData();
  body.set('file', file);
  const response = await fetch('/api/admin/media/upload', {
    method: 'POST',
    body,
    credentials: 'same-origin'
  });
  const envelope = await response.json() as UploadEnvelope;
  if (!response.ok || !envelope.success) {
    throw new Error(envelope.error?.code ?? 'MEDIA_UPLOAD_FAILED');
  }
}

export function AdminMediaUploader() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const mutation = useMutation({
    mutationFn: async (files: readonly File[]) => {
      for (const file of files) {
        await uploadFile(file);
      }
    },
    onSuccess: async () => {
      setMessageTone('success');
      setMessage('فایل با موفقیت ثبت شد و پیش از نمایش عمومی کنترل‌های سرور را گذرانده است.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'media'] });
    },
    onError: () => {
      setMessageTone('danger');
      setMessage('آپلود انجام نشد. نوع، پسوند، حجم و مجوز دسترسی را بررسی کنید.');
    }
  });

  return (
    <div className="space-y-3">
      <FilePicker
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf"
        disabled={mutation.isPending}
        maxBytes={20 * 1024 * 1024}
        onFilesAccepted={(files) => mutation.mutate(files)}
        onRejected={(reason) => { setMessageTone('danger'); setMessage(reason); }}
      />
      {message ? <Toast tone={messageTone}>{message}</Toast> : null}
    </div>
  );
}
