import { authenticatedAccessToken } from '../../auth';
import { requestBlob } from '../../../shared/api/client';
import type { ProjectReportType } from '../model/report';
import { reportPeriodError } from '../model/report';

export async function exportProjectReport(project: string, type: ProjectReportType, from: string, to: string) {
  const error = reportPeriodError(from, to);
  if (error) throw new Error(error);
  const query = new URLSearchParams({ type, from, to });
  const token = await authenticatedAccessToken();
  const blob = await requestBlob(`/api/work/projects/${encodeURIComponent(project)}/reports/export?${query}`, token);
  if (!blob.type.toLowerCase().startsWith('text/csv')) throw new Error('Máy chủ trả về báo cáo không đúng định dạng CSV.');
  return { blob, filename: `tasknest-project-${project}-${type.toLowerCase()}-${from}-${to}.csv` };
}
