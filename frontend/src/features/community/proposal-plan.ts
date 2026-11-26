export const planSections = [
  { key: 'scope', title: 'Phạm vi thực hiện', hint: 'Liệt kê chức năng, sản phẩm bàn giao và phần nằm ngoài phạm vi.' },
  { key: 'approach', title: 'Cách thực hiện', hint: 'Nêu các bước triển khai, công nghệ, người phụ trách và cách cập nhật tiến độ.' },
  { key: 'milestones', title: 'Mốc bàn giao và nghiệm thu', hint: 'Ghi từng mốc, thời điểm, đầu ra và tiêu chí để khách hàng xác nhận.' },
] as const;

export function readProposalPlan(plan: string) {
  const sections = { scope: '', approach: '', milestones: '' };
  const parts = plan.split(/^## (Phạm vi thực hiện|Cách thực hiện|Mốc bàn giao và nghiệm thu)\s*$/m);
  if (parts.length !== 7 || parts[0].trim() || planSections.some((section, index) => section.title !== parts[index * 2 + 1])) {
    return { ...sections, scope: plan, structured: false };
  }
  planSections.forEach(({ key }, index) => { sections[key] = parts[index * 2 + 2].trim(); });
  return { ...sections, structured: true };
}
