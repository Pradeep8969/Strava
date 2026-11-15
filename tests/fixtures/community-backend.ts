/** Served-response adapter for browser tests only. Not imported by app code. */
export function communityBackendFixture(
  _g: unknown,
  _r: unknown,
  _i: unknown,
  _a: unknown,
  _m: unknown,
  exports: Record<string, unknown>,
) {
  type Row = Record<string, unknown>;
  const now = Date.now(),
    day = 86400000,
    viewer = "test-viewer";
  const iso = (n: number) => new Date(n).toISOString();
  let session: unknown = {
    user: { id: viewer, email: "athlete@example.test", user_metadata: {} },
  };
  let failedReads = false,
    failedWrites = false;
  const callbacks = new Set<(event: string, session: unknown) => void>();
  const tables: Record<string, Row[]> = {
    profiles: [
      {
        id: viewer,
        name: "Test Athlete",
        username: "test_athlete",
        avatar_path: "test-viewer/avatar.svg",
      },
      { id: "test-friend", name: "Test Maya", username: "test_maya" },
    ],
    clubs: [
      {
        id: "test-valley",
        name: "Test Valley Runners",
        description:
          "Test fixture · early starts, valley trails and good company.",
      },
      {
        id: "test-lakeside",
        name: "Test Pokhara Riders",
        description:
          "Test fixture · a community for social rides and days outside.",
      },
    ],
    club_members: [
      {
        club_id: "test-valley",
        user_id: viewer,
        joined_at: iso(now - 5 * day),
      },
    ],
    challenges: [
      {
        id: "test-distance",
        club_id: null,
        title: "Test 100 km Challenge",
        target_m: 100000,
        starts_at: iso(now - 7 * day),
        ends_at: iso(now + 14 * day),
      },
      {
        id: "test-club-goal",
        club_id: "test-valley",
        title: "Test Valley Miles",
        target_m: 50000,
        starts_at: iso(now - day),
        ends_at: iso(now + 21 * day),
      },
    ],
    challenge_entries: [
      {
        challenge_id: "test-distance",
        user_id: viewer,
        joined_at: iso(now - 2 * day),
      },
    ],
    follows: [{ follower_id: viewer, following_id: "test-friend" }],
    activities: [
      {
        id: "fixture-run",
        user_id: viewer,
        title: "Test morning trail run",
        description: "Test fixture · a little movement before the day begins.",
        sport: "running",
        visibility: "public",
        distance_m: 1340,
        moving_seconds: 600,
        started_at: iso(now - 3600000),
      },
      {
        id: "test-friend-ride",
        user_id: "test-friend",
        title: "Test lakeside ride",
        description: "Test fixture · fresh air and a slower morning.",
        sport: "cycling",
        visibility: "public",
        distance_m: 12400,
        moving_seconds: 2400,
        started_at: iso(now - 2 * 3600000),
      },
    ],
    activity_reactions: [
      { activity_id: "fixture-run", user_id: "test-friend" },
    ],
    comments: [
      {
        id: "test-comment",
        activity_id: "fixture-run",
        user_id: "test-friend",
        body: "Test fixture · great morning to get outside!",
        created_at: iso(now - 1800000),
      },
    ],
    segments: [],
  };
  const calls: {
    table: string;
    columns: string;
    filters: [string, unknown][];
    operation: string;
  }[] = [];
  class Query {
    filters: [string, unknown][] = [];
    conditions: ((row: Row) => boolean)[] = [];
    operation = "read";
    columns = "";
    payload: Row = {};
    maximum = 1000;
    sortKey = "";
    ascending = true;
    constructor(public table: string) {}
    select(columns: string) {
      this.columns = columns;
      return this;
    }
    eq(key: string, value: unknown) {
      this.filters.push([key, value]);
      this.conditions.push((row) => row[key] === value);
      return this;
    }
    in(key: string, values: unknown[]) {
      this.conditions.push((row) => values.includes(row[key]));
      return this;
    }
    gt(key: string, value: string) {
      this.conditions.push((row) => String(row[key]) > value);
      return this;
    }
    order(key: string, options?: { ascending?: boolean }) {
      this.sortKey = key;
      this.ascending = options?.ascending ?? true;
      return this;
    }
    limit(max: number) {
      this.maximum = max;
      return this;
    }
    upsert(payload: Row) {
      this.payload = payload;
      this.operation = "upsert";
      return this;
    }
    insert(payload: Row) {
      this.payload = payload;
      this.operation = "insert";
      return this;
    }
    delete() {
      this.operation = "delete";
      return this;
    }
    execute(single = false) {
      calls.push({
        table: this.table,
        columns: this.columns,
        filters: this.filters,
        operation: this.operation,
      });
      if (failedReads && this.operation === "read")
        return { data: null, error: new Error("Test connection unavailable") };
      if (failedWrites && this.operation !== "read")
        return { data: null, error: new Error("Test write rejected") };
      const rows = tables[this.table] ?? [];
      const matches = (row: Row) => this.conditions.every((fn) => fn(row));
      if (this.operation === "delete")
        tables[this.table] = rows.filter((row) => !matches(row));
      if (this.operation === "insert" || this.operation === "upsert") {
        const duplicate = rows.some((row) =>
          Object.entries(this.payload).every(
            ([key, value]) => row[key] === value,
          ),
        );
        if (!duplicate || this.operation === "insert")
          rows.push({
            ...this.payload,
            id: `test-insert-${rows.length}`,
            joined_at: iso(Date.now()),
            created_at: iso(Date.now()),
          });
        tables[this.table] = rows;
      }
      let available = (tables[this.table] ?? []).filter(matches);
      // Simulate the existing member-only challenge visibility policy.
      if (this.table === "challenges")
        available = available.filter(
          (row) =>
            !row.club_id ||
            tables.club_members.some(
              (member) =>
                member.club_id === row.club_id && member.user_id === viewer,
            ),
        );
      if (this.table === "activities")
        available = available.map((row) => ({
          ...row,
          activity_reactions: [
            {
              count: tables.activity_reactions.filter(
                (like) => like.activity_id === row.id,
              ).length,
            },
          ],
          comments: [
            {
              count: tables.comments.filter(
                (comment) => comment.activity_id === row.id,
              ).length,
            },
          ],
        }));
      if (this.sortKey)
        available.sort(
          (a, b) =>
            String(a[this.sortKey]).localeCompare(String(b[this.sortKey])) *
            (this.ascending ? 1 : -1),
        );
      const data = available.slice(0, this.maximum);
      return { data: single ? (data[0] ?? null) : data, error: null };
    }
    maybeSingle() {
      return Promise.resolve(this.execute(true));
    }
    single() {
      return this.maybeSingle();
    }
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(this.execute()).then(resolve);
    }
  }
  const client = {
    from: (table: string) => new Query(table),
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: {
            signedUrl:
              "data:image/svg+xml," +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#17695D"/><text x="40" y="48" text-anchor="middle" fill="white" font-family="Arial" font-size="24">TA</text></svg>',
              ),
          },
          error: null,
        }),
      }),
    },
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (fn: (event: string, value: unknown) => void) => {
        callbacks.add(fn);
        return {
          data: { subscription: { unsubscribe: () => callbacks.delete(fn) } },
        };
      },
      signOut: async () => {
        session = null;
        callbacks.forEach((fn) => fn("SIGNED_OUT", null));
        return { error: null };
      },
      startAutoRefresh() {},
      stopAutoRefresh() {},
    },
  };
  (globalThis as unknown as { __communityTest: unknown }).__communityTest = {
    calls,
    failReads: (value: boolean) => {
      failedReads = value;
    },
    failWrites: (value: boolean) => {
      failedWrites = value;
    },
    signOut: client.auth.signOut,
  };
  exports.supabase = client;
  exports.backend = () => client;
}
