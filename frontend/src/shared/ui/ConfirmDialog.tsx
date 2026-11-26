import { Modal } from './Modal';
import { Button } from './Button';

export type Confirmation = { title: string; description: string; run: () => void };
export function ConfirmDialog({ confirmation, onClose }: { confirmation?: Confirmation; onClose: () => void }) {
  return <Modal open={!!confirmation} title={confirmation?.title ?? 'Xác nhận thao tác'} onClose={onClose}>
    <p className="text-sm leading-6 text-muted">{confirmation?.description}</p>
    <div className="mt-6 flex justify-end gap-3"><Button kind="secondary" onClick={onClose}>Hủy</Button><Button onClick={() => { const run = confirmation?.run; onClose(); run?.(); }}>Xác nhận</Button></div>
  </Modal>;
}
