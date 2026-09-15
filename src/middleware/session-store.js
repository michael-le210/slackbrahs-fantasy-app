import crypto from "node:crypto";

const defaultMaxAgeSeconds = 60 * 60 * 24 * 30;

export class SessionStore {
  constructor({ maxAgeSeconds = defaultMaxAgeSeconds, secure = false } = {}) {
    this.maxAgeSeconds = maxAgeSeconds;
    this.secure = secure;
    this.sessions = new Map();
    this.nextCleanupAt = 0;
  }

  get(req, res) {
    const now = Date.now();
    this.cleanup(now);
    const cookies = parseCookies(req.headers.cookie || "");
    let id = cookies.yfb_session;
    let session = id ? this.sessions.get(id) : null;
    if (!session || this.isExpired(session, now)) {
      if (id) this.sessions.delete(id);
      id = crypto.randomBytes(24).toString("hex");
      session = { id, createdAt: now, lastAccessedAt: now };
      this.sessions.set(id, session);
      res.setHeader("Set-Cookie", this.cookie(id));
    }
    session.lastAccessedAt = now;
    return session;
  }

  destroy(session) {
    this.sessions.delete(session.id);
  }

  cookie(value, maxAge = this.maxAgeSeconds) {
    return sessionCookie(value, maxAge, this.secure);
  }

  cleanup(now = Date.now()) {
    if (now < this.nextCleanupAt) return;
    for (const [id, session] of this.sessions) {
      if (this.isExpired(session, now)) this.sessions.delete(id);
    }
    this.nextCleanupAt = now + Math.min(this.maxAgeSeconds * 1000, 60 * 60_000);
  }

  isExpired(session, now = Date.now()) {
    return now - (session.lastAccessedAt || session.createdAt) >= this.maxAgeSeconds * 1000;
  }
}

export function sessionCookie(value, maxAge = defaultMaxAgeSeconds, secure = false) {
  return `yfb_session=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function parseCookies(cookieHeaderValue) {
  return Object.fromEntries(
    cookieHeaderValue
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), safeDecode(part.slice(index + 1))];
      })
  );
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
