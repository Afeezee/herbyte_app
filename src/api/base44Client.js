/**
 * Compatibility client. Exposes the exact surface the frontend already
 * imports from `@base44/sdk`, so pages stay unchanged.
 *
 * All requests carry the Clerk session token from `window.Clerk`. If Clerk
 * isn't ready yet (initial load, sign-out just happened), calls fall back
 * to unauthenticated and the server rejects them with 401 — which the
 * existing error paths already handle by redirecting to sign-in.
 *
 * NOTE ON THE NAME: the export is still called `base44` so nothing has to
 * change during phases 2–6. Phase 7 renames imports across the codebase
 * (and this file) to `client.js` / `api`; phase 10 removes the alias
 * entirely.
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

class ApiError extends Error {
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

// ---------------------------------------------------------------------------
// Entities — mirror base44.entities.<X>.{list, filter, create, update, delete}
// ---------------------------------------------------------------------------

/**
 * Build a sort/limit-aware query object. The Base44 SDK's `list` takes an
 * optional sort string like '-created_date' and optional limit; `filter`
 * additionally takes a where object as its first arg.
 */
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
  User: entityClient('User'), // admin listing only; see policies
}

// ---------------------------------------------------------------------------
// Auth — mirror base44.auth.{me, updateMe, logout, redirectToLogin}
// ---------------------------------------------------------------------------

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
    // Clerk's signOut clears the session and redirects.
    clerk.signOut({ redirectUrl: returnUrl ?? '/sign-in' }).catch(() => {})
  },
  redirectToLogin(returnUrl) {
    const target = returnUrl ?? window.location.href
    const search = new URLSearchParams({ redirect_url: target }).toString()
    window.location.assign(`/sign-in?${search}`)
  },
}

// ---------------------------------------------------------------------------
// Integrations — the only three the app actually calls: InvokeLLM,
// UploadFile, SendEmail. Dead exports (SendSMS, GenerateImage,
// ExtractDataFromUploadedFile) are intentionally omitted.
// ---------------------------------------------------------------------------

/**
 * Multiplex InvokeLLM to the four AI endpoints. The Base44 SDK took a
 * single generic call; on our side each endpoint has its own prompt +
 * schema + budget check. The frontend already passes shape-specific
 * payloads to each call site, so we detect which endpoint from the caller
 * argument.
 *
 * For phases 2–3 this returns a friendly "not implemented" error so pages
 * degrade correctly rather than blowing up; phase 4 wires the real routing.
 */
async function InvokeLLM(payload) {
  const endpoint = payload?.__endpoint ?? 'assistant'
  return request(`/ai/${endpoint}`, { method: 'POST', body: payload })
}

/**
 * Upload via a multipart form to /api/upload. Server responds with
 * `{ file_url }` — same shape the Base44 SDK returned so no page changes.
 */
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
  Core: {
    InvokeLLM,
    UploadFile,
    SendEmail,
  },
}

// ---------------------------------------------------------------------------

export const base44 = {
  entities,
  auth,
  integrations,
}

export { ApiError }
