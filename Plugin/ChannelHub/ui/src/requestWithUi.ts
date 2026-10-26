import { showMessage } from './feedback';

export interface RequestUiOptions {
  showLoader?: boolean;
  suppressErrorMessage?: boolean;
}

export async function requestWithUi<T>(request: {
  url: string;
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}, options: RequestUiOptions = {}): Promise<T> {
  const url = new URL(request.url, window.location.origin);
  for (const [key, value] of Object.entries(request.query || {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  try {
    const response = await fetch(url, {
      method: request.method || 'GET', credentials: 'same-origin',
      headers: request.body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    if (response.status === 401) throw new Error('管理员登录已失效，请在宿主管理面板重新登录后刷新此页。');
    const result = await response.json();
    if (!response.ok || result.success === false) {
      throw new Error(result.error?.message || result.error || result.message || `HTTP ${response.status}`);
    }
    return result as T;
  } catch (error) {
    if (!options.suppressErrorMessage) showMessage(error instanceof Error ? error.message : String(error), 'error');
    throw error;
  }
}
