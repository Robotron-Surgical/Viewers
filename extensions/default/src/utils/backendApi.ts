/**
 * Shared backend API client with anonymous session JWT auth.
 *
 * On first import the module lazily initialises a session token by calling
 * `POST /auth/session`.  Every subsequent call through {@link backendFetch}
 * attaches the token as `Authorization: Bearer <token>`.
 *
 * The token is persisted in `sessionStorage` so it survives soft reloads
 * but not new tabs/windows (each tab gets its own session).
 */

const BACKEND_URL: string =
  (process.env.REACT_APP_BACKEND_URL as string) || 'http://localhost:8000';

const TOKEN_STORAGE_KEY = 'mri_genius_session_token';
const SESSION_ID_STORAGE_KEY = 'mri_genius_session_id';

let _tokenPromise: Promise<string> | null = null;

export function getBackendUrl(): string {
  return BACKEND_URL;
}

async function _initSession(): Promise<string> {
  const existing = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const res = await fetch(`${BACKEND_URL}/auth/session`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Failed to create session: ${res.status}`);
  }
  const data = await res.json();
  if (typeof data.access_token !== 'string' || typeof data.session_id !== 'string') {
    throw new Error('Invalid session response: access_token and session_id must be strings');
  }
  sessionStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
  sessionStorage.setItem(SESSION_ID_STORAGE_KEY, data.session_id);
  return data.access_token;
}

/**
 * Returns the current session JWT, initialising one if necessary.
 * Safe to call multiple times — concurrent calls share one in-flight request.
 */
export async function getSessionToken(): Promise<string> {
  if (!_tokenPromise) {
    _tokenPromise = _initSession().catch(err => {
      _tokenPromise = null;
      throw err;
    });
  }
  return _tokenPromise;
}

/**
 * Drop-in replacement for `fetch` that prepends the backend URL and injects
 * the `Authorization` header.
 *
 * @param path   Absolute path on the backend, e.g. `/segmentation?studyInstanceUIDs=…`
 * @param init   Standard `RequestInit` — additional headers are merged (not overwritten).
 */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getSessionToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const url = `${BACKEND_URL}${path}`;
  const response = await fetch(url, { ...init, headers });

  if (response.status === 401) {
    // Token expired or invalid — clear and retry once
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_ID_STORAGE_KEY);
    _tokenPromise = null;

    const freshToken = await getSessionToken();
    const retryHeaders = new Headers(init.headers);
    retryHeaders.set('Authorization', `Bearer ${freshToken}`);
    return fetch(url, { ...init, headers: retryHeaders });
  }

  return response;
}

/**
 * Upload via XMLHttpRequest with progress tracking and auth header.
 * Used for the direct `/upload_dicom` form-data upload.
 */
export async function backendUploadXHR(
  path: string,
  formData: FormData,
  onProgress?: (pct: number) => void,
): Promise<XMLHttpRequest> {
  const token = await getSessionToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BACKEND_URL}${path}`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) {
          onProgress((e.loaded / e.total) * 100);
        }
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr);
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}
