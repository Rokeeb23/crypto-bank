import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const walletAPI = {
  list: () => api.get('/wallets/list'),
  add: (data) => api.post('/wallets/add', data),
  remove: (id) => api.delete(`/wallets/remove?id=${id}`),
  getBalances: () => api.get('/wallets/balances'),
  getPrices: () => api.get('/wallets/prices'),
};

export const transactionAPI = {
  create: (data) => api.post('/transactions/create', data),
  authorize: (transactionId) => api.post('/transactions/authorize', { transaction_id: transactionId }),
  confirm: (transactionId, txHash) => api.post('/transactions/confirm', { transaction_id: transactionId, tx_hash: txHash }),
  reject: (transactionId) => api.post('/transactions/reject', { transaction_id: transactionId }),
  list: (params) => api.get('/transactions/list', { params }),
  detail: (id) => api.get(`/transactions/detail?id=${id}`),
  checkStatus: (id) => api.get(`/transactions/status?id=${id}`),
  detect: (params) => api.get('/transactions/detect', { params }),
};

export const sendAPI = {
  withKey: (data) => api.post('/send/with-key', data),
};

export const adminAPI = {
  getUsers: (params) => api.get('/admin/users', { params }),
  getUserDetail: (id) => api.get(`/admin/user-detail?id=${id}`),
  updateUser: (data) => api.put('/admin/update-user', data),
  getAllTransactions: (params) => api.get('/admin/all-transactions', { params }),
  getStats: () => api.get('/admin/stats'),
};

export default api;
