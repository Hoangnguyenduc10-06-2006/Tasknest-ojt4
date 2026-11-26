
export type TaskChecklistItem = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

export function suggestChecklistSteps(taskTitle: string, description?: string, aiHint?: string): string[] {
  const extracted: string[] = [];
  const rawSources = [description ?? '', aiHint ?? ''].join('\n');
  for (const line of rawSources.split(/\r?\n|[.;]/)) {
    const cleaned = line
      .replace(/^[\s\-*•\d.)]+/, '')
      .trim();
    if (cleaned.length >= 6 && cleaned.length <= 160 && !extracted.some((s) => s.toLocaleLowerCase('vi') === cleaned.toLocaleLowerCase('vi'))) {
      extracted.push(cleaned);
    }
    if (extracted.length >= 4) break;
  }
  if (extracted.length >= 2) return extracted;
  const shortTitle = taskTitle.trim() || 'nhiệm vụ';
  return [
    `Rà soát yêu cầu và tiêu chí nghiệm thu cho "${shortTitle}"`,
    'Thực hiện phần việc chính và ghi nhận giờ làm thực tế',
    'Tự kiểm thử kết quả và chuẩn bị tệp/liên kết bàn giao',
    'Gửi chờ duyệt kèm ghi chú kết quả chi tiết',
  ];
}

export function summarizeChecklist(items: TaskChecklistItem[]) {
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
}
