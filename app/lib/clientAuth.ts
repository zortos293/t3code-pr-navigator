type ErrorPayload = { error?: string };

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.assign('/login');
  }
}

export async function readApiError(response: Response, fallbackMessage: string): Promise<string> {
  if (response.status === 401) {
    redirectToLogin();
    return 'Authentication required';
  }

  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      const payload = await response.json() as ErrorPayload;
      if (payload.error) {
        return payload.error;
      }
    } catch {
      return fallbackMessage;
    }
  }

  return fallbackMessage;
}
