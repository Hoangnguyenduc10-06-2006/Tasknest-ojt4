export const developerRoles = [
  { label: 'Full-stack Developer', terms: ['full-stack', 'fullstack', 'full stack'] },
  { label: 'Frontend Developer', terms: ['frontend', 'front-end', 'giao diện'] },
  { label: 'Backend Developer', terms: ['backend', 'back-end', 'api'] },
  { label: 'Kỹ sư Python', terms: ['python', 'django', 'fastapi'] },
  { label: 'Lập trình viên Mobile', terms: ['mobile', 'android', 'ios', 'flutter', 'react native'] },
  { label: 'Kỹ sư dữ liệu', terms: ['dữ liệu', 'data engineer', 'etl', 'analytics'] },
  { label: 'Kỹ sư DevOps', terms: ['devops', 'hạ tầng', 'kubernetes', 'ci/cd'] },
  { label: 'Kỹ sư kiểm thử', terms: ['kiểm thử', 'qa', 'tester', 'playwright'] },
  { label: 'Thiết kế UX/UI', terms: ['thiết kế', 'ux', 'figma', 'product design'] },
];

export function matchingRoleTerms(roles: string[]) {
  return [...new Set(roles.flatMap(role => {
    const normalized = role.trim().toLowerCase();
    if (!normalized) return [];
    const preset = developerRoles.find(option => option.label.toLowerCase() === normalized);
    return preset?.terms ?? [normalized];
  }))].join(',').slice(0, 500);
}
