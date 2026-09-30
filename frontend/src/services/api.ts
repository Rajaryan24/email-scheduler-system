import axios from 'axios';
import { SchedulePayload, EmailJob, DashboardStats } from '../types';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE
});

// Interceptor to add Auth Token header if logged in
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  googleLogin: async (payload: { email: string; name?: string; avatar?: string; googleId?: string }) => {
    const res = await api.post('/auth/google', payload);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  }
};

export const emailApi = {
  schedule: async (payload: SchedulePayload) => {
    const res = await api.post('/emails/schedule', payload);
    return res.data;
  },
  getScheduled: async (): Promise<{ emails: EmailJob[] }> => {
    const res = await api.get('/emails/scheduled');
    return res.data;
  },
  getSent: async (): Promise<{ emails: EmailJob[] }> => {
    const res = await api.get('/emails/sent');
    return res.data;
  },
  getStats: async (): Promise<{ stats: DashboardStats }> => {
    const res = await api.get('/emails/stats');
    return res.data;
  },
  search: async (query: string, status?: string): Promise<{ emails: EmailJob[] }> => {
    const res = await api.get('/emails/search', { params: { q: query, status } });
    return res.data;
  },
  parseLeadFile: async (fileContent: string) => {
    const res = await api.post('/emails/parse-leads', { text: fileContent });
    return res.data;
  }
};

export const slackApi = {
  getStatus: async () => {
    const res = await api.get('/slack/status');
    return res.data;
  },
  connectWebhook: async (webhookUrl: string, channelName?: string) => {
    const res = await api.post('/slack/connect', { webhookUrl, channelName });
    return res.data;
  },
  disconnect: async () => {
    const res = await api.post('/slack/disconnect');
    return res.data;
  },
  sendTestAlert: async () => {
    const res = await api.post('/slack/test');
    return res.data;
  }
};

export default api;
