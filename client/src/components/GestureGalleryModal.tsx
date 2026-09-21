import { Loader2, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { gestureApi, type GalleryListItem, type GestureWork } from "../services/gestureApi";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenWork: (work: GestureWork) => void;
  getCurrentSnapshot: () => { work: GestureWork; thumbnail: string } | null;
};

export default function GestureGalleryModal({ open, onClose, onOpenWork, getCurrentSnapshot }: Props) {
  const [items, setItems] = useState<GalleryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  const refresh = () => {
    setLoading(true);
    setError("");
    gestureApi
      .listGallery()
      .then(setItems)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Could not load your saved work"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  if (!open) return null;

  const saveCurrent = async () => {
    const snapshot = getCurrentSnapshot();
    if (!snapshot) return;
    if (snapshot.work.strokes.length === 0) {
      setError("Draw something on the canvas first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await gestureApi.saveToGallery(title.trim() || `Drawing ${new Date().toLocaleString()}`, snapshot.work, snapshot.thumbnail);
      setTitle("");
      refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save this drawing");
    } finally {
      setSaving(false);
    }
  };

  const openItem = async (id: string) => {
    setOpeningId(id);
    setError("");
    try {
      const item = await gestureApi.getGalleryItem(id);
      onOpenWork({ strokes: item.strokes, transcript: item.transcript, lastGesture: item.lastGesture });
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not open this drawing");
    } finally {
      setOpeningId(null);
    }
  };

  const remove = async (id: string) => {
    try {
      await gestureApi.deleteGalleryItem(id);
      setItems((prev) => prev.filter((item) => item._id !== id));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete this drawing");
    }
  };

  return (
    <div className="gesture-modal-overlay" onClick={onClose}>
      <div className="gesture-modal" onClick={(event) => event.stopPropagation()}>
        <div className="gesture-modal-head">
          <h3>My saved work</h3>
          <button className="gesture-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="gesture-modal-save-row">
          <input
            type="text"
            placeholder="Name this drawing (optional)"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
          />
          <button className="button button-primary" onClick={() => void saveCurrent()} disabled={saving}>
            {saving ? <Loader2 className="spin" size={15} /> : null} Save current as new
          </button>
        </div>

        {error && <div className="gesture-modal-error">{error}</div>}

        {loading ? (
          <div className="gesture-modal-loading">
            <Loader2 className="spin" size={18} /> Loading your saved drawings…
          </div>
        ) : items.length === 0 ? (
          <div className="gesture-modal-empty">Nothing saved yet. Draw something and use "Save current as new" above.</div>
        ) : (
          <div className="gesture-gallery-grid">
            {items.map((item) => (
              <div className="gesture-gallery-card" key={item._id}>
                <button className="gesture-gallery-thumb" onClick={() => void openItem(item._id)} disabled={openingId === item._id}>
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} />
                  ) : (
                    <span className="gesture-gallery-thumb-empty">No preview</span>
                  )}
                  {openingId === item._id && (
                    <span className="gesture-gallery-thumb-loading">
                      <Loader2 className="spin" size={18} />
                    </span>
                  )}
                </button>
                <div className="gesture-gallery-meta">
                  <strong title={item.title}>{item.title}</strong>
                  <small>{new Date(item.createdAt).toLocaleDateString()}</small>
                </div>
                <button className="gesture-gallery-delete" onClick={() => void remove(item._id)} aria-label={`Delete ${item.title}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
