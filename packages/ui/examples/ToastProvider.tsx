import {useState} from 'react';
import {Button, ToastProvider, useToast} from '@airgen/ui';

function NotifyButtons() {
  const {info, toast, dismiss} = useToast();
  const [noticeId, setNoticeId] = useState<string | null>(null);
  return (
    <>
      <Button type="button" onClick={() => info('Saved')}>
        Notify
      </Button>
      <Button
        type="button"
        disabled={noticeId !== null}
        onClick={() => {
          setNoticeId(toast('Waiting for confirmation', {duration: 0}));
        }}
      >
        Persistent notice
      </Button>
      <Button
        type="button"
        disabled={noticeId === null}
        onClick={() => {
          if (noticeId) dismiss(noticeId);
          setNoticeId(null);
        }}
      >
        Dismiss notice
      </Button>
    </>
  );
}

export function ToastProviderExample() {
  return (
    <ToastProvider position="top-right">
      <NotifyButtons />
    </ToastProvider>
  );
}
