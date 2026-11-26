import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AiAnswerMarkdown from './FormattedAiAnswer';

describe('AiAnswerMarkdown', () => {
  it('formats headings, lists, emphasis, code and tables', () => {
    const text = '## Ưu tiên hôm nay\n\n1. **Kiểm tra API**\n2. Chạy `npm test`\n\n| Việc | Trạng thái |\n| --- | --- |\n| API | Đang làm |';
    const html = renderToStaticMarkup(<AiAnswerMarkdown text={text} />);

    expect(html).toContain('<h2>Ưu tiên hôm nay</h2>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<strong>Kiểm tra API</strong>');
    expect(html).toContain('<code>npm test</code>');
    expect(html).toContain('<td>Đang làm</td>');
  });

  it('keeps model-generated link labels as text and omits HTML and remote images', () => {
    const text = '[Xem chi tiết](https://example.com) ![Ảnh](https://example.com/image.png)\n\n<script>alert(1)</script>';
    const html = renderToStaticMarkup(<AiAnswerMarkdown text={text} />);

    expect(html).toContain('Xem chi tiết');
    expect(html).not.toMatch(/<a\b|<img\b|<script\b|example\.com/);
  });
});
