/* Roteia imagens de OLX/ML/WM via /api/img — bypassa hotlink protection.
   URLs de outros hosts ou já proxiadas passam direto. */
const PROXY_HOSTS = ['img.olx.com.br', 'imagens.olx.com.br', 'i.cdn.olx.com.br',
                     'http2.mlstatic.com', 'mlstatic.com',
                     'image.webmotors.com.br', 'image-static.webmotors.com.br', 'www.webmotors.com.br'];

export function proxyImg(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('/api/img')) return url;
  if (url.startsWith('data:')) return url;
  try {
    const u = new URL(url);
    if (!PROXY_HOSTS.includes(u.hostname)) return url;
    return `/api/img?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}
