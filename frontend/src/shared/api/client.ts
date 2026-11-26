export class ApiError extends Error {
  constructor(public readonly status: number, message = `Yêu cầu thất bại (HTTP ${status}).`, public readonly code?: string) { super(message); }
}
// Same-origin only. Auth/CSRF and coordinated refresh will be added with Identity.
// Access Tokens must stay in memory; never put them in localStorage.
export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!path.startsWith('/api/') || path.includes('..')) throw new Error('Đường dẫn API không hợp lệ.');
  const response = await fetch(path, {
    credentials: 'same-origin', headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}

export async function requestJson<T>(path: string, options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; csrf?: boolean; accessToken?: string; timeoutMs?: number } = {}): Promise<T> {
  if (!path.startsWith('/api/') || path.includes('..')) throw new Error('Đường dẫn API không hợp lệ.');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.csrf) {
    await getJson('/api/identity/status');
    const token = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='))?.slice('XSRF-TOKEN='.length);
    if (!token) throw new Error('Không thể khởi tạo bảo vệ phiên. Vui lòng tải lại trang.');
    headers['X-XSRF-TOKEN'] = decodeURIComponent(token);
  }
  const response = await fetch(path, {
    method: options.method ?? 'GET', credentials: 'same-origin', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
  });
  const data = await response.json().catch(() => null) as { message?: string; data?: { code?: string } } | null;
  if (!response.ok) throw new ApiError(response.status, data?.message || `Yêu cầu thất bại (HTTP ${response.status}).`, data?.data?.code);
  return data as T;
}

export async function requestBlob(path: string, accessToken?: string): Promise<Blob> {
  if (!path.startsWith('/api/') || path.includes('..')) throw new Error('Đường dẫn API không hợp lệ.');
  const response = await fetch(path, { credentials: 'same-origin', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string; code?: string } | null;
    throw new ApiError(response.status, error?.message || `Yêu cầu thất bại (HTTP ${response.status}).`, error?.code);
  }
  return response.blob();
}

export async function requestForm<T>(path: string, body: FormData, accessToken: string): Promise<T> {
  if (!path.startsWith('/api/') || path.includes('..')) throw new Error('Đường dẫn API không hợp lệ.');
  const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{Accept:'application/json',Authorization:`Bearer ${accessToken}`},body,signal:AbortSignal.timeout(120000)});
  const result=await response.json().catch(()=>null) as {message?:string}|null;
  if(!response.ok)throw new ApiError(response.status,result?.message||'Không thể tải tệp.');
  return result as T;
}
