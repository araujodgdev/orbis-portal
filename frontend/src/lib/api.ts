// frontend/src/lib/api.ts
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init });
  if (res.status === 401 && window.location.pathname !== '/login') {
    window.location.href = '/login';
    throw new Error(`API 401 em ${path} — redirecionando para login`);
  }
  if (!res.ok) throw new Error(`API ${res.status} em ${path}`);
  return res.json() as Promise<T>;
}
