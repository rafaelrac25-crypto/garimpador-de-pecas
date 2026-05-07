import axios from 'axios';

/* baseURL relativa: dev usa proxy do Vite, prod usa mesmo domínio do front. */
const api = axios.create({
  baseURL: '',
  timeout: 30000,
});

/* Sem gate de token — backend libera quando ACCESS_KEY env não está setada.
   Mantém compat com link antigo: se localStorage tem key, ainda manda. */
api.interceptors.request.use((config) => {
  const key = localStorage.getItem('garimpador_access_key');
  if (key) {
    config.headers = config.headers || {};
    config.headers['X-Access-Key'] = key;
  }
  return config;
});

export default api;
