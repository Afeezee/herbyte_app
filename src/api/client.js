/**
 * Frontend API client. Talks to /api on this same host, carrying the
 * Clerk session token as a Bearer.
 */

const API_BASE = '/api'

async function getClerkToken() {
  const clerk = typeof window !== 'undefined' ? window.Clerk : null
  if (!clerk?.session) return null
  try {
    return await clerk.session.getToken()
  } catch {
    return null
  }
}

export class ApiError extends Error {
  constructor(status, code, message, body) {
    super(message ?? code ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = body
  }
}

async function request(path, { method = 'GET', body, query, headers } = {}) {
  const token = await getClerkToken()
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)))
      else url.searchParams.append(k, String(v))
    }
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let json
  const text = await res.text()
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
  }
  if (!res.ok) {
    const err = json?.error ?? {}
    throw new ApiError(res.status, err.code, err.message, json)
  }
  return json
}

function buildListQuery(where, sort, limit) {
  const q = {}
  if (where) {
    for (const [k, v] of Object.entries(where)) {
      if (v === undefined || v === null) continue
      q[k] = v
    }
  }
  if (sort) q.sort = sort
  if (limit !== undefined && limit !== null) q.limit = limit
  return q
}

function entityClient(name) {
  const base = `/entities/${name}`
  return {
    async list(sort, limit) {
      return request(base, { query: buildListQuery(null, sort, limit) })
    },
    async filter(where, sort, limit) {
      return request(base, { query: buildListQuery(where, sort, limit) })
    },
    async get(id) {
      return request(`${base}/${encodeURIComponent(id)}`)
    },
    async create(data) {
      return request(base, { method: 'POST', body: data })
    },
    async update(id, data) {
      return request(`${base}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: data,
      })
    },
    async delete(id) {
      return request(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
  }
}

const entities = {
  Herb: entityClient('Herb'),
  Remedy: entityClient('Remedy'),
  Product: entityClient('Product'),
  Event: entityClient('Event'),
  Comment: entityClient('Comment'),
  RemedySubmission: entityClient('RemedySubmission'),
  HerbSubmission: entityClient('HerbSubmission'),
  SellerProfile: entityClient('SellerProfile'),
  Wishlist: entityClient('Wishlist'),
  User: entityClient('User'),
}

const auth = {
  async me() {
    return request('/auth/me')
  },
  async updateMe(data) {
    return request('/auth/me', { method: 'PATCH', body: data })
  },
  logout(returnUrl) {
    const clerk = typeof window !== 'undefined' ? window.Clerk : null
    if (!clerk) {
      if (returnUrl) window.location.assign(returnUrl)
      return
    }
    clerk.signOut({ redirectUrl: returnUrl ?? '/sign-in' }).catch(() => {})
  },
  redirectToLogin(returnUrl) {
    const target = returnUrl ?? window.location.href
    const search = new URLSearchParams({ redirect_url: target }).toString()
    window.location.assign(`/sign-in?${search}`)
  },
}

// ---------------------------------------------------------------------------
// AI advice endpoints. Each frontend call site targets one specific
// endpoint by name — no more generic InvokeLLM.
// ---------------------------------------------------------------------------

const ai = {
  assistant: (input) => request('/ai/assistant', { method: 'POST', body: input }),
  herbInsight: (input) => request('/ai/herb-insight', { method: 'POST', body: input }),
  remedyInsight: (input) => request('/ai/remedy-insight', { method: 'POST', body: input }),
  searchSuggestions: (input) =>
    request('/ai/search-suggestions', { method: 'POST', body: input }),
}

const submissions = {
  remedy: (input) => request('/submissions/remedy', { method: 'POST', body: input }),
  herb: (input) => request('/submissions/herb', { method: 'POST', body: input }),
  publishRemedy: (id, overrides) =>
    request(`/submissions/remedy/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: overrides ?? {},
    }),
  publishHerb: (id, overrides) =>
    request(`/submissions/herb/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: overrides ?? {},
    }),
}

// AI regeneration — fills in missing fields on an agent-generated
// herb or remedy using the moderation pipeline. Admin only.
const regenerate = {
  herb: (id) =>
    request(`/regenerate/herb/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: {},
    }),
  remedy: (id) =>
    request(`/regenerate/remedy/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: {},
    }),
  // Image-only — cheap, no LLM. Works on any record, published or not.
  herbImage: (id) =>
    request(`/regenerate/herb/${encodeURIComponent(id)}/image`, {
      method: 'POST',
      body: {},
    }),
  remedyImage: (id) =>
    request(`/regenerate/remedy/${encodeURIComponent(id)}/image`, {
      method: 'POST',
      body: {},
    }),
}

// Agent runs — admin-only on-demand trigger. Options:
//   n:         1..12
//   kind:      'random' | 'herb' | 'remedy'
//   research:  'random' | 'force' | 'skip'
//   draftOnly: boolean (submit but skip auto-publish, land in queue)
//   dryRun:    boolean (don't submit, just show what would happen)
const agent = {
  run: (opts) =>
    request('/agent/run', {
      method: 'POST',
      body: opts ?? {},
    }),
}

// ---------------------------------------------------------------------------
// Uploads + email — the legacy SDK exposed these under
// `integrations.Core.*`; we keep that path so the small number of
// remaining SDK-shaped calls in the app still resolve.
// ---------------------------------------------------------------------------

async function UploadFile({ file }) {
  const token = await getClerkToken()
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) {
    const err = json?.error ?? {}
    throw new ApiError(res.status, err.code, err.message, json)
  }
  return json
}

async function SendEmail(payload) {
  return request('/contact', { method: 'POST', body: payload })
}

const integrations = {
  Core: { UploadFile, SendEmail },
  UploadFile,
  SendEmail,
}

// ---------------------------------------------------------------------------

export const api = {
  entities,
  auth,
  ai,
  submissions,
  regenerate,
  agent,
  integrations,
  // Convenience aliases so pages don't have to reach into integrations.Core.
  UploadFile,
  SendEmail,
}
