import { workspaceHeaders } from '@/lib/workspace';

/** Upload a pasted/dropped image to the server and return its markdown URL */
export async function uploadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...workspaceHeaders() },
          body: JSON.stringify({ data: reader.result, filename: file.name }),
        });
        if (!res.ok) throw new Error('Upload failed');
        const { url } = await res.json();
        resolve(url);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Handle paste event on an MDEditor — uploads images and inserts markdown */
export function handleEditorPaste(
  event: React.ClipboardEvent,
  currentValue: string,
  onChange: (value: string) => void,
) {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      event.preventDefault();
      const file = item.getAsFile();
      if (!file) return;

      uploadImage(file).then((url) => {
        const markdown = `![image](${url})`;
        onChange(currentValue ? currentValue + '\n' + markdown : markdown);
      });
      return;
    }
  }
}
