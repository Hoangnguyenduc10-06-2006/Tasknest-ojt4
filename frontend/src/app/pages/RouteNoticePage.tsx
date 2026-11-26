export function RouteNoticePage() {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-6 sm:p-10">
      <p className="text-sm font-semibold text-accent">
        404
      </p>
      <h1 className="mt-3 text-2xl font-bold">
        Không tìm thấy trang
      </h1>
      <p className="mt-4 leading-7 text-muted">
        Đường dẫn này không tồn tại. Bạn có thể quay lại trang giới thiệu hoặc tổng quan.
      </p>
      <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold text-accent">
        <a href="/dashboard" className="hover:underline">
          Về tổng quan
        </a>
        <a href="/" className="hover:underline">
          Trang giới thiệu
        </a>
      </div>
    </section>
  );
}
