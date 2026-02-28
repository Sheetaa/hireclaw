const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function request(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  // Auth
  register: (data: { email: string; password: string; name: string; role: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  
  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  
  getProfile: () => request('/profile'),
  
  updateProfile: (data: { name?: string; avatarUrl?: string }) =>
    request('/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Agents
  listAgents: (params?: { status?: string; capability?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/agents${query ? `?${query}` : ''}`);
  },
  
  getAgent: (id: string) => request(`/agents/${id}`),
  
  createAgent: (data: { name: string; description?: string; capabilities?: string[] }) =>
    request('/agents', { method: 'POST', body: JSON.stringify(data) }),
  
  updateAgentStatus: (id: string, status: string) =>
    request(`/agents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  
  getAgentHealth: (id: string) => request(`/agents/${id}/health`),

  // Tasks
  listTasks: (params?: { role?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/tasks${query ? `?${query}` : ''}`);
  },
  
  getTask: (id: string) => request(`/tasks/${id}`),
  
  createTask: (data: { title: string; description: string; taskType: string }) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  
  assignAgent: (taskId: string, agentId: string) =>
    request(`/tasks/${taskId}/assign-agent`, { method: 'POST', body: JSON.stringify({ agentId }) }),
  
  payDeposit: (taskId: string) =>
    request(`/tasks/${taskId}/deposit`, { method: 'POST' }),
  
  acceptTask: (taskId: string) =>
    request(`/tasks/${taskId}/accept`, { method: 'POST' }),
  
  deliverTask: (taskId: string, deliverables: any) =>
    request(`/tasks/${taskId}/deliver`, { method: 'POST', body: JSON.stringify({ deliverables }) }),
  
  payBaseFee: (taskId: string) =>
    request(`/tasks/${taskId}/pay-base-fee`, { method: 'POST' }),
  
  submitFeedback: (taskId: string, type: string, reasonText?: string) =>
    request(`/tasks/${taskId}/feedback`, { method: 'POST', body: JSON.stringify({ type, reasonText }) }),
  
  tip: (taskId: string, amount: number) =>
    request(`/tasks/${taskId}/tip`, { method: 'POST', body: JSON.stringify({ amount }) }),

  // Dashboard
  getOwnerEarnings: () => request('/owner/earnings'),
  getOwnerTasks: () => request('/owner/tasks'),
  getHirerTasks: () => request('/hirer/tasks'),
  getHirerSpending: () => request('/hirer/spending'),
  getMetrics: () => request('/dashboard/metrics'),
};

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
  }
}

export function clearToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
  }
}
