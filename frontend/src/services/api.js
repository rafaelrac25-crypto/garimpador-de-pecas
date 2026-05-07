import axios from 'axios';

/* baseURL relativa: dev usa proxy do Vite, prod usa mesmo domínio do front. */
const api = axios.create({
  baseURL: '',
  timeout: 30000,
});

/* Interceptor: injeta o token de acesso em toda requisição.
   Lê do localStorage. Se não tiver, deixa passar sem (backend retorna 401
   e o App.jsx mostra a tela de bloqueio). */
api.interceptors.request.use((config) => {
  const key = localStorage.getItem('garimpador_access_key');
  if (key) {
    config.headers = config.headers || {};
    config.headers['X-Access-Key'] = key;
  }
  return config;
});

/* Interceptor de resposta: 401 → limpa token e força tela de bloqueio */
api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err?.response?.status === 401) {
      const path = window.location.pathname;
      /* Não limpa em endpoints de health (evita loop) */
      if (!err.config?.url?.includes('/api/health')) {
        localStorage.removeItem('garimpador_access_key');
        if (path !== '/' && !path.includes('?key=')) {
          /* Recarrega pra mostrar gate */
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
