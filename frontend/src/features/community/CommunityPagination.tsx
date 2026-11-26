import { Button } from '../../shared/ui/Button';

export function Pagination({
  page,
  total,
  size,
  onChange,
}: {
  page: number;
  total: number;
  size: number;
  onChange: (value: number) => void;
}) {
  if (total <= size) return null;
  return (
    <div className="flex items-center justify-end gap-3 py-3">
      <Button
        kind="secondary"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        Trước
      </Button>
      <span className="text-sm">
        Trang {page + 1} / {Math.ceil(total / size)}
      </span>
      <Button
        kind="secondary"
        disabled={(page + 1) * size >= total}
        onClick={() => onChange(page + 1)}
      >
        Sau
      </Button>
    </div>
  );
}
