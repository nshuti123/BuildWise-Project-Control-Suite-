import { useState, useRef } from "react";
import { Camera, Upload, X, ZoomIn, Trash2, ImageIcon } from "lucide-react";
import api from "../api";
import { mediaUrl } from "../utils/mediaUrl";

export type TaskPhoto = {
  id: number;
  image_url?: string;
  image?: string;
  caption?: string;
  uploaded_by_name?: string;
  created_at?: string;
};

type Props = {
  taskId: number;
  photos: TaskPhoto[];
  canUpload?: boolean;
  onPhotosChange: () => void;
};

export function TaskProgressPhotos({
  taskId,
  photos,
  canUpload = true,
  onPhotosChange,
}: Props) {
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const photoSrc = (p: TaskPhoto) => mediaUrl(p.image_url || p.image);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      if (caption.trim()) fd.append("caption", caption.trim());
      await api.post(`/projects/tasks/${taskId}/upload-photo/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      onPhotosChange();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId: number) => {
    if (!window.confirm("Remove this progress photo?")) return;
    try {
      await api.delete(`/projects/tasks/${taskId}/photos/${photoId}/`);
      onPhotosChange();
      if (previewUrl) setPreviewUrl(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete photo.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Camera size={16} className="text-indigo-600" />
          Progress photos
        </label>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {photos.length}
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {canUpload && (
        <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/80">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            >
              <Upload size={16} />
              {uploading ? "Uploading…" : "Add photo"}
            </button>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Optional caption (e.g. Foundation pour — Day 3)"
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Attach site photos so the team can verify progress visually.
          </p>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 border border-slate-100 rounded-xl bg-white">
          <ImageIcon size={32} className="opacity-40 mb-2" />
          <p className="text-sm">No progress photos yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm"
            >
              <img
                src={photoSrc(photo)}
                alt={photo.caption || "Task progress"}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 gap-1">
                {photo.caption && (
                  <p className="text-[10px] text-white font-medium line-clamp-2">
                    {photo.caption}
                  </p>
                )}
                {photo.uploaded_by_name && (
                  <p className="text-[9px] text-white/80">{photo.uploaded_by_name}</p>
                )}
                <div className="flex gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(photoSrc(photo))}
                    className="p-1.5 bg-white/90 text-slate-800 rounded-md hover:bg-white"
                    title="View full size"
                  >
                    <ZoomIn size={14} />
                  </button>
                  {canUpload && (
                    <button
                      type="button"
                      onClick={() => handleDelete(photo.id)}
                      className="p-1.5 bg-red-500/90 text-white rounded-md hover:bg-red-600"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full"
            onClick={() => setPreviewUrl(null)}
          >
            <X size={28} />
          </button>
          <img
            src={previewUrl}
            alt="Progress preview"
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
