import axios from "axios";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
};

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: 180000,
});

function messageFromError(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED") {
      return "Face processing is taking longer than expected. Please try again.";
    }
    return (error.response?.data as { message?: string } | undefined)?.message || "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

export const authApi = {
  async register(payload: { name: string; email: string; images: string[] }) {
    try {
      const { data } = await api.post<{ success: boolean; message: string; user: PublicUser }>("/auth/register", payload);
      return data;
    } catch (error) {
      throw new Error(messageFromError(error));
    }
  },
  async login(payload: { email: string; image: string }) {
    try {
      const { data } = await api.post<{ success: boolean; message: string; user: PublicUser }>("/auth/login", payload);
      return data;
    } catch (error) {
      throw new Error(messageFromError(error));
    }
  },
  async me() {
    try {
      const { data } = await api.get<{ success: boolean; user: PublicUser }>("/user/me");
      return data.user;
    } catch {
      return null;
    }
  },
  async logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // Clearing local state remains safe if the server session already expired.
    }
  },
};
