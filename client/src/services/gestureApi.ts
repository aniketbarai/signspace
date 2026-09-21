import axios from "axios";

export type Landmark = { x: number; y: number; z: number };
export type GestureResult = { gesture: string; confidence: number; landmarks: Landmark[]; handedness: string | null };
export type Stroke = { points: [number, number][]; color: string; width: number };
export type GestureWork = { strokes: Stroke[]; transcript: string[]; lastGesture: string };

const api = axios.create({ baseURL: "/api", withCredentials: true, headers: { "Content-Type": "application/json" }, timeout: 30000 });

function messageFromError(error: unknown) {
  if (axios.isAxiosError(error)) return (error.response?.data as { message?: string } | undefined)?.message || "Gesture service is unavailable";
  return "Gesture service is unavailable";
}

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
};
