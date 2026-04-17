const fsp = require("node:fs/promises");
const path = require("node:path");

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "p") {
  const rand = Math.random().toString(16).slice(2, 10);
  return `${prefix}-${Date.now().toString(16)}-${rand}`;
}

async function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `${path.basename(filePath)}.${makeId("tmp")}.tmp`);
  const payload = JSON.stringify(data, null, 2);
  await fsp.writeFile(tmp, payload, "utf8");
  await fsp.rename(tmp, filePath);
}

class CommunityStore {
  constructor(filePath) {
    this.filePath = filePath;
    this._lock = Promise.resolve();
  }

  async ensure() {
    try {
      await fsp.stat(this.filePath);
    } catch {
      const initial = { posts: [] };
      await atomicWriteJson(this.filePath, initial);
    }
  }

  async _read() {
    const raw = await fsp.readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.posts)) {
      return { posts: [] };
    }
    return parsed;
  }

  async _write(next) {
    await atomicWriteJson(this.filePath, next);
  }

  async _withLock(fn) {
    // Chain locks to serialize writes.
    const run = async () => fn();
    this._lock = this._lock.then(run, run);
    return this._lock;
  }

  async getTop({ limit = 30 } = {}) {
    const data = await this._read();
    return data.posts
      .slice()
      .sort((a, b) => {
        const diff = (b.likes || 0) - (a.likes || 0);
        if (diff !== 0) return diff;
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      })
      .slice(0, limit);
  }

  async getRandom() {
    const data = await this._read();
    if (!data.posts.length) return null;
    const idx = Math.floor(Math.random() * data.posts.length);
    return data.posts[idx];
  }

  async addPost({ text, tags = [] }) {
    return this._withLock(async () => {
      const data = await this._read();
      const post = {
        id: makeId("post"),
        text,
        tags: tags.map(String).slice(0, 6),
        likes: 0,
        createdAt: nowIso(),
      };
      data.posts.unshift(post);
      await this._write(data);
      return post;
    });
  }

  async like(id) {
    return this._withLock(async () => {
      const data = await this._read();
      const post = data.posts.find((p) => p.id === id);
      if (!post) return null;
      post.likes = (post.likes || 0) + 1;
      await this._write(data);
      return post;
    });
  }
}

module.exports = { CommunityStore };

