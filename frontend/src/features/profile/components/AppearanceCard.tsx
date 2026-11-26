import { useTheme, type Theme } from '../../../shared/theme/useTheme';

const modes: { value: Theme; label: string; hint: string }[] = [
  { value: 'light', label: 'Sáng', hint: 'Luôn dùng giao diện sáng' },
  { value: 'dark', label: 'Tối', hint: 'Luôn dùng giao diện tối' },
  { value: 'system', label: 'Theo hệ thống', hint: 'Tự đổi theo thiết bị' },
];
export function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  return <aside className="panel appearance-card">
    <div><h2>Giao diện</h2><p>Đồng bộ ngay với bộ chọn trên thanh trên cùng.</p></div>
    <div className="theme-options" role="group" aria-label="Chọn giao diện">
      {modes.map(mode => <button type="button" key={mode.value} className={theme === mode.value ? 'active' : ''} aria-pressed={theme === mode.value} onClick={() => setTheme(mode.value)}>
        <span className={`theme-preview ${mode.value}`} aria-hidden="true"><i /><b /></span>
        <span><strong>{mode.label}</strong><small>{mode.hint}</small></span><i className="radio-mark" aria-hidden="true" />
      </button>)}
    </div>
    <p className="permission-note mt-4">Lựa chọn được ghi nhớ trên trình duyệt này. Chưa đồng bộ giữa các thiết bị.</p>
  </aside>;
}
