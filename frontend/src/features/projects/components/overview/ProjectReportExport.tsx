import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../../../shared/ui/Button';
import { Modal } from '../../../../shared/ui/Modal';
import { businessToday } from '../../../../shared/utils/business-date';
import { exportProjectReport } from '../../api/project-report.api';
import { reportPeriodError, type ProjectReportType } from '../../model/report';
import { useProjects } from '../../hooks/useProjects';

export function ProjectReportExport({ project }: { project: string }) {
  const projectInfo = useProjects().find(item => item.id === project);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ProjectReportType>('TASKS');
  const [to, setTo] = useState(() => businessToday(Date.now()));
  const [from, setFrom] = useState(() => {
    const date = new Date(`${businessToday(Date.now())}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 29);
    return date.toISOString().slice(0, 10);
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const invalid = reportPeriodError(from, to);
  const manager = projectInfo?.role === 'Owner' || projectInfo?.role === 'Manager';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || invalid) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const file = await exportProjectReport(project, type, from, to);
      if (!mounted.current) return;
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      try { link.click(); } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setOpen(false);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Không thể xuất báo cáo. Vui lòng thử lại.');
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return <>
    <Button variant="secondary" onClick={() => { setError(''); setOpen(true); }}>Xuất báo cáo CSV</Button>
    {open && <Modal open title="Xuất báo cáo dự án" onClose={() => { if (!busy.current) setOpen(false); }}>
      <form onSubmit={event => void submit(event)} className="space-y-5">
        <label className="field"><span>Loại báo cáo</span>
          <select value={type} disabled={pending} onChange={event => { setType(event.target.value as ProjectReportType); setError(''); }}>
            <option value="TASKS">Tiến độ nhiệm vụ theo deadline</option>
            <option value="TIME">Nhật ký giờ làm</option>
            <option value="SPRINT">Tổng hợp sprint</option>
          </select>
        </label>
        <div className="field-row">
          <label className="field"><span>Từ ngày</span><input type="date" required value={from} disabled={pending} onChange={event => { setFrom(event.target.value); setError(''); }} aria-describedby="report-period-error" aria-invalid={Boolean(invalid)} /></label>
          <label className="field"><span>Đến ngày</span><input type="date" required value={to} disabled={pending} onChange={event => { setTo(event.target.value); setError(''); }} aria-describedby="report-period-error" aria-invalid={Boolean(invalid)} /></label>
        </div>
        <p className="text-xs leading-6 text-muted">{type === 'TASKS'
          ? 'Gồm nhiệm vụ có deadline trong khoảng ngày, trạng thái hiện tại, giờ ước tính toàn nhiệm vụ và giờ đã ghi trong kỳ.'
          : type === 'TIME'
            ? 'Gồm các phiên có thời gian nằm trong khoảng ngày. Phiên qua ngày chỉ tính phần trong kỳ; timer đang chạy được tính đến lúc xuất.'
            : 'Gồm một bảng tóm tắt các chỉ số của sprint: việc mở, tạo mới, hoàn thành, quá hạn, bị chặn và tổng giờ làm trong kỳ.'}</p>
        <p className="text-xs leading-6 text-muted">{manager
          ? 'Phạm vi: nhiệm vụ và giờ làm của các thành viên trong dự án.'
          : type === 'TASKS' || type === 'SPRINT'
            ? 'Phạm vi: các nhiệm vụ đang giao cho bạn và chỉ giờ làm của bạn.'
            : 'Phạm vi: chỉ giờ làm của bạn, kể cả nhiệm vụ đã được giao lại cho người khác.'}
          {' '}Ngày và giờ theo múi giờ Việt Nam. Tối đa 366 ngày và 10.000 dòng mỗi lần xuất.</p>
        <p id="report-period-error" className="text-sm text-danger" role={invalid ? 'alert' : undefined}>{invalid}</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>Đóng</Button>
          <Button type="submit" loading={pending} disabled={Boolean(invalid)}>Tải CSV</Button>
        </div>
      </form>
    </Modal>}
  </>;
}
