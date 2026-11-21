import { useEffect, useState, type ChangeEvent } from 'react';
import { Check, Upload, X } from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { useToast } from '../common/ToastContext';
import { adminApi } from '../../lib/api';
import type { MediaAssetRecord } from '../../types/isp';

interface MediaPickerModalProps {
  open: boolean;
  selectedUrl?: string | null;
  defaultCategory?: string;
  onSelect: (asset: { file_url: string; alt_text: string }) => void;
  onClose: () => void;
}

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export function MediaPickerModal({
  open,
  selectedUrl,
  defaultCategory = 'general',
  onSelect,
  onClose,
}: MediaPickerModalProps) {
  const { showToast } = useToast();
  const [media, setMedia] = useState<MediaAssetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [altText, setAltText] = useState('');

  async function loadMedia() {
    setLoading(true);
    try {
      const res = await adminApi.getMedia();
      setMedia(res.media);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load media library.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      loadMedia();
      setAltText('');
    }
  }, [open]);

  if (!open) return null;

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      showToast('Please select a PNG, JPEG, WebP, GIF, or ICO image.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size must be 2 MB or less.', 'error');
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await readFileAsBase64(file);
      const uploaded = await adminApi.uploadMedia({
        file_name: file.name,
        file_type: file.type,
        alt_text: altText.trim() || file.name.replace(/\.[^.]+$/, ''),
        category: defaultCategory,
        data_base64: dataUrl,
      });
      showToast('Image uploaded to Media Library.');
      setMedia((prev) => [uploaded, ...prev]);
      onSelect({ file_url: uploaded.file_url, alt_text: uploaded.alt_text });
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F4D]/45 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#0B1F4D]">Select or Upload Image</h2>
            <p className="text-xs text-slate-500">
              Choose an existing asset or upload a new PNG, JPEG, WebP, GIF, or ICO (max 2 MB).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Upload Strip */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-[#F8FAFC] px-6 py-3.5">
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="SEO alt text for new upload (optional)"
            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
          />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#0B1F4D] px-4 py-2 text-xs font-medium text-white hover:bg-[#132F70]">
            <Upload className="h-3.5 w-3.5" />
            <span>{uploading ? 'Uploading...' : 'Upload New Image'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
              disabled={uploading}
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : media.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No images in Media Library yet. Upload one above.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {media.map((item) => {
                const isSelected = selectedUrl === item.file_url;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect({ file_url: item.file_url, alt_text: item.alt_text });
                      onClose();
                    }}
                    className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-colors ${
                      isSelected
                        ? 'border-[#0B1F4D] ring-2 ring-[#0B1F4D]/20'
                        : 'border-slate-200 hover:border-[#0B1F4D]'
                    }`}
                  >
                    <div className="relative h-28 w-full bg-slate-100">
                      <ImageWithFallback
                        src={item.file_url}
                        alt={item.alt_text || item.file_name}
                        className="h-full w-full object-cover"
                        fallbackTitle={item.file_name}
                      />
                      {isSelected && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#0B1F4D] text-white">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-xs font-medium text-[#0B1F4D]">
                        {item.file_name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {item.alt_text || item.category}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
