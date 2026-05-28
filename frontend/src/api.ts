import axios from 'axios';

export const API_BASE = '/api';

let token: string | null = localStorage.getItem('brimble_token');

export function setToken(t: string | null) {
    token = t;
    if (t) localStorage.setItem('brimble_token', t);
    else localStorage.removeItem('brimble_token');
}

export function getToken() { return token; }

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use(config => {
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});
