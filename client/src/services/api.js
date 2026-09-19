import axios from 'axios';

const API_BASE = import.meta.env.VITE_SERVER_URL
  ? `${import.meta.env.VITE_SERVER_URL.replace(/\/$/, '')}/api`
  : '/api';

export const api = axios.create({ baseURL: API_BASE, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('framehouse_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const unwrap = (request) => request.then((response) => response.data);

export const authApi = {
  me: () => unwrap(api.get('/auth/me')),
  login: (payload) => unwrap(api.post('/auth/login', payload)),
  register: (payload) => unwrap(api.post('/auth/register', payload)),
  logout: () => unwrap(api.post('/auth/logout')),
};

export const eventApi = {
  list: () => unwrap(api.get('/events?limit=50')),
  get: (id) => unwrap(api.get(`/events/${id}`)),
  create: (payload) => unwrap(api.post('/events', payload)),
  update: (id, payload) => unwrap(api.patch(`/events/${id}`, payload)),
  photos: (id, params = {}) => unwrap(api.get(`/events/${id}/photos`, { params: { limit: 200, ...params } })),
  bulkSelect: (id, photoIds, isSelected) => unwrap(api.post(`/events/${id}/photos/bulk-select`, { photoIds, isSelected })),
  listTeamMembers: (search = '') => unwrap(api.get(`/events/team-members?search=${encodeURIComponent(search)}`)),
  listMembers: (id) => unwrap(api.get(`/events/${id}/members`)),
  addMember: (id, userId) => unwrap(api.post(`/events/${id}/members`, { userId })),
  removeMember: (id, userId) => unwrap(api.delete(`/events/${id}/members/${userId}`)),
  getUploadUrl: (id, payload) => unwrap(api.post(`/events/${id}/photos/upload-url`, payload)),
  completeUpload: (id, payload) => unwrap(api.post(`/events/${id}/photos/complete`, payload)),
};

// Client upload helper for S3 / direct uploads
export async function uploadPhotoFile(eventId, file, onProgress) {
  // Compute checksum
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 1. Get presigned upload URL
  const { data: uploadData } = await eventApi.getUploadUrl(eventId, {
    filename: file.name,
    mimeType: file.type || 'image/jpeg',
    fileSize: file.size,
    checksum,
  });

  if (uploadData.duplicate) {
    return { duplicate: true, existingPhoto: uploadData.existingPhoto };
  }

  const { photoId, presignedUrl } = uploadData;

  // 2. Upload file binary directly to Presigned URL
  await axios.put(presignedUrl, file, {
    headers: { 'Content-Type': file.type || 'image/jpeg' },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });

  // 3. Mark upload complete
  const completeRes = await eventApi.completeUpload(eventId, {
    photoId,
    checksum,
    fileSize: file.size,
  });

  return completeRes.data;
}

export const galleryApi = {
  create: (eventId, payload) => unwrap(api.post(`/events/${eventId}/galleries`, payload)),
  list: (eventId) => unwrap(api.get(`/events/${eventId}/galleries`)),
  get: (id) => unwrap(api.get(`/galleries/${id}`)),
  addPhotos: (id, photoIds) => unwrap(api.post(`/galleries/${id}/photos`, { photoIds })),
  publish: (id) => unwrap(api.post(`/galleries/${id}/publish`)),
  unpublish: (id) => unwrap(api.post(`/galleries/${id}/unpublish`)),
  analytics: (id) => unwrap(api.get(`/galleries/${id}/analytics`)),
  publicInfo: (slug) => unwrap(api.get(`/public/gallery/${slug}`)),
  verifyPin: (slug, pin) => unwrap(api.post(`/public/gallery/${slug}/verify-pin`, { pin })),
  photos: (slug, page = 1, limit = 200) => unwrap(api.get(`/public/gallery/${slug}/photos`, { params: { page, limit } })),
  favorite: (slug, photoId) => unwrap(api.post(`/public/gallery/${slug}/photos/${photoId}/favorite`)),
  download: (slug, photoId) => unwrap(api.post(`/public/gallery/${slug}/photos/${photoId}/download`)),
};

export const analyticsApi = {
  dashboard: () => unwrap(api.get('/analytics/dashboard')),
  event: (id) => unwrap(api.get(`/analytics/events/${id}`)),
  auditLogs: (params) => unwrap(api.get('/analytics/audit-logs', { params })),
};
