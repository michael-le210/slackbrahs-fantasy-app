import crypto from "node:crypto";

export class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  get(req, res) {
    const cookies = parseCookies(req.headers.cookie || "");
    let id = cookies.yfb_session;
    if (!id || !this.sessions.has(id)) {
      id = crypto.randomBytes(24).toString("hex");
      this.sessions.set(id, { id, createdAt: Date.now() });
      res.setHeader("Set-Cookie", sessionCookie(id));
    }
    return this.sessions.get(id);
  }

  destroy(session) {
    this.sessions.delete(session.id);
  }
}

export function sessionCookie(value, maxAge = 60 * 60 * 24 * 30) {
  return `yfb_session=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
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
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}
