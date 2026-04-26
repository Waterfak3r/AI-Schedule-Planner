const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const { CommunityStore } = require("../server/communityStore");

test("CommunityStore creates missing directories and normalizes posts", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asp-community-test-"));
  const filePath = path.join(tempRoot, "nested", "community.json");
  const store = new CommunityStore(filePath);

  try {
    const post = await store.addPost({
      text: "  hello community  ",
      tags: [" study ", "", "code", "workout", "other", "extra", "ignored"],
    });

    assert.equal(post.text, "hello community");
    assert.deepEqual(post.tags, ["study", "code", "workout", "other", "extra", "ignored"]);

    const top = await store.getTop({ limit: 1 });
    assert.equal(top.length, 1);
    assert.equal(top[0].id, post.id);

    const liked = await store.like(` ${post.id} `);
    assert.equal(liked.likes, 1);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
