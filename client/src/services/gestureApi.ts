import axios from "axios";

export type Landmark = { x: number; y: number; z: number };
export type GestureResult = { gesture: string; confidence: number; landmarks: Landmark[]; handedness: string | null };
export type Stroke = { points: [number, number][]; color: string; width: number };
export type GestureWork = { strokes: Stroke[]; transcript: string[]; lastGesture: string };
export type GalleryListItem = { _id: string; title: string; thumbnail: string; createdAt: string; updatedAt: string };
export type GalleryItem = GalleryListItem & GestureWork;

const api = axios.create({ baseURL: "/api", withCredentials: true, headers: { "Content-Type": "application/json" }, timeout: 30000 });

const LOCAL_KEY = "signspace.gesture-work.v1";

function messageFromError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; code?: string } | undefined;
    if (data?.code === "DB_NOT_CONFIGURED") return "Server storage isn't configured yet, so this save is kept only on this device.";
    return data?.message || "Gesture service is unavailable";
  }
  return "Gesture service is unavailable";
}

/** Best-effort local backup. Never throws — a broken localStorage should never break drawing. */
export const localWork = {
  load(): GestureWork | null {
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.strokes)) return null;
      return parsed as GestureWork;
    } catch {
      return null;
    }
  },
  save(work: GestureWork) {
    try {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(work));
    } catch {
      // Storage full or unavailable (private browsing) — silently skip the backup.
    }
  },
};

export const gestureApi = {
  async recognize(image: string) {
    try {
      const { data } = await api.post<{ success: boolean } & GestureResult>("/gesture/recognize", { image });
      return data;
    } catch (error) {
      throw new Error(messageFromError(error));
    }
  },
  async getWork(): Promise<GestureWork> {
    try {
      const { data } = await api.get<{ success: boolean; work: GestureWork }>("/gesture/work");
      return data.work;
    } catch (error) {
      throw new Error(messageFromError(error));
    }
  },
  async saveWork(work: GestureWork) {
    try {
      const { data } = await api.put<{ success: boolean; work: GestureWork }>("/gesture/work", work);
      return data.work;
    } catch (error) {
      throw new Error(messageFromError(error));
    }
  },
  async listGallery(): Promise<GalleryListItem[]> {
    try {
      const { data } = await api.get<{ success: boolean; items: GalleryListItem[] }>("/gesture/gallery");
      return data.items;
    } catch (error) {
      throw new Error(messageFromError(error));
    }
  },
  async saveToGallery(title: string, work: GestureWork, thumbnail: string): Promise<GalleryItem> {
    try {
      const { data } = await api.post<{ success: boolean; item: GalleryItem }>("/gesture/gallery", { ...work, title, thumbnail });
      return data.item;
    } catch (error) {
      throw new Error(messageFromError(error));
    }
  },
  async getGalleryItem(id: string): Promise<GalleryItem> {
    try {
      const { data } = await api.get<{ success: boolean; item: GalleryItem }>(`/gesture/gallery/${id}`);
      return data.item;
    } catch (error) {
      throw new Error(messageFromError(error));
    }
  },
  async deleteGalleryItem(id: string): Promise<void> {
    try {
      await api.delete(`/gesture/gallery/${id}`);
    } catch (error) {
      throw new Error(messageFromError(error));
    }
  },
};
