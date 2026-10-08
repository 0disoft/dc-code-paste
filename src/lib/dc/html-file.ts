export function createReadableHtmlFile(html: string) {
  return {
    filename: `dc-code-paste-${new Date().toISOString().replaceAll(":", "-")}.html`,
    content: `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>dc-code-paste 글</title></head><body style="margin:0">${html}</body></html>`,
  };
}

export function downloadReadableHtml(html: string) {
  const file = createReadableHtmlFile(html);
  const url = URL.createObjectURL(new Blob([file.content], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = file.filename;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
