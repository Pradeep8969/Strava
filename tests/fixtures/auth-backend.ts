/** Simulated Supabase server for isolated browser tests. Never imported by app code. */
export function authBackendFixture(
  _g: unknown,
  _r: unknown,
  _i: unknown,
  _a: unknown,
  _m: unknown,
  exports: Record<string, unknown>,
) {
  type User = {
    id: string;
    email: string;
    user_metadata: object;
    identities?: object[];
    app_metadata?: object;
  };
  type Row = Record<string, unknown>;
  const key = "__phase6_server_fixture";
  const saved = JSON.parse(localStorage.getItem(key) ?? "null");
  const state = saved ?? {
    accounts: {} as Record<string, User>,
    notifications: [] as Row[],
    session: null,
    pendingEmail: "",
    used: [] as string[],
    fail: false,
    cancel: false,
  };
  const authListeners = new Set<(event: string, value: unknown) => void>(),
    channels = new Set<{ filter: string; fn: () => void }>();
  state.profiles ??= {};
  state.details ??= {};
  state.avatars ??= {};
  const persist = () => localStorage.setItem(key, JSON.stringify(state));
  const emit = () => {
    persist();
    authListeners.forEach((fn) => fn("SIGNED_IN", state.session));
  };
  const welcome = (email: string) => {
    let user = state.accounts[email];
    if (!user) {
      user = {
        id: `phase6-account-${Object.keys(state.accounts).length + 1}`,
        email,
        user_metadata: {},
      };
      state.accounts[email] = user;
      state.profiles[user.id] = {
        id: user.id,
        name: "Athlete",
        bio: "",
        username: null,
        is_private: true,
        avatar_path: null,
      };
      state.notifications.push({
        id: `welcome-${user.id}`,
        user_id: user.id,
        kind: "welcome",
        title: "Welcome to StravaKinda! 🏔️",
        body: "Your adventure starts here. Track your first activity, discover Nepal's trails, and connect with fellow athletes.",
        created_at: new Date().toISOString(),
        read_at: null,
      });
      persist();
    }
    return user;
  };
  const setUser = (user: User | null, event = "SIGNED_IN") => {
    state.session = user ? { user, access_token: "isolated-test-token" } : null;
    persist();
    authListeners.forEach((fn) => fn(event, state.session));
  };
  class Query {
    table: string;
    filters: ((r: Row) => boolean)[] = [];
    change: Row | null = null;
    count = false;
    maximum = 50;
    one = false;
    constructor(table: string) {
      this.table = table;
    }
    select(_columns?: string, options?: { count?: string }) {
      this.count = !!options?.count;
      return this;
    }
    eq(k: string, v: unknown) {
      this.filters.push((row) => row[k] === v);
      return this;
    }
    is(k: string, v: unknown) {
      return this.eq(k, v);
    }
    order() {
      return this;
    }
    limit(n: number) {
      this.maximum = n;
      return this;
    }
    update(row: Row) {
      this.change = row;
      return this;
    }
    maybeSingle() {
      this.one = true;
      return this;
    }
    single() {
      this.one = true;
      return this;
    }
    execute() {
      if (state.fail)
        return {
          data: null,
          error: { message: "Simulated offline" },
          count: null,
        };
      const owner = state.session?.user.id;
      let rows: Row[] =
        this.table === "notifications"
          ? state.notifications.filter((r: Row) => r.user_id === owner)
          : this.table === "profiles" && owner
            ? [state.profiles[owner]]
            : this.table === "athlete_details" && owner && state.details[owner]
              ? [state.details[owner]]
              : [];
      rows = rows.filter((r) => this.filters.every((fn) => fn(r)));
      if (this.change) {
        if (!(
          (this.table === "notifications" &&
            Object.keys(this.change).every((k) => k === "read_at")) ||
          (this.table === "profiles" &&
            Object.keys(this.change).every((k) =>
              ["name", "avatar_path", "bio", "username", "is_private"].includes(
                k,
              ),
            ))
        ))
          return { data: null, error: { message: "Permission denied" } };
        rows.forEach((row) => Object.assign(row, this.change));
        persist();
        channels.forEach((c) => c.fn());
      }
      return {
        data: JSON.parse(
          JSON.stringify(
            this.one ? (rows[0] ?? null) : rows.slice(0, this.maximum),
          ),
        ),
        error: null,
        count: this.count ? rows.length : null,
      };
    }
    then(resolve: (result: unknown) => unknown) {
      return Promise.resolve(this.execute()).then(resolve);
    }
  }
  const client = {
    from: (table: string) => new Query(table),
    rpc: async (
      name: string,
      args: {
        patch: Row;
        details: Row;
        expected: Row;
        expected_revision: number;
      },
    ) => {
      const id = state.session?.user.id;
      if (state.fail)
        return { error: { message: "Simulated offline. Try saving again." } };
      if (!id || name !== "save_athlete_details")
        return { error: { message: "Denied" } };
      if (
        Object.keys(args.patch).some(
          (key) => state.profiles[id][key] !== args.expected[key],
        ) ||
        (state.details[id]?.revision ?? 0) !== args.expected_revision
      )
        return { error: { message: "Profile changed elsewhere" } };
      Object.assign(state.profiles[id], args.patch);
      state.details[id] = {
        ...args.details,
        id,
        revision: args.expected_revision + 1,
      };
      persist();
      return { data: null, error: null };
    },
    storage: {
      from: () => ({
        upload: async (
          path: string,
          bytes: ArrayBuffer,
          options: { contentType: string },
        ) => {
          if (!path.startsWith(`${state.session?.user.id}/`))
            return { error: { message: "Denied" } };
          state.avatars[path] =
            `data:${options.contentType};base64,${btoa(String.fromCharCode(...new Uint8Array(bytes)))}`;
          persist();
          return { data: { path }, error: null };
        },
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: state.avatars[path] },
          error: null,
        }),
        remove: async (paths: string[]) => {
          paths.forEach((path) => {
            if (path.startsWith(`${state.session?.user.id}/`))
              delete state.avatars[path];
          });
          persist();
          return { error: null };
        },
      }),
    },
    auth: {
      getUser: async () => ({
        data: { user: state.session?.user ?? null },
        error: null,
      }),
      getSession: async () => ({
        data: { session: state.session },
        error: null,
      }),
      onAuthStateChange: (fn: (event: string, value: unknown) => void) => {
        authListeners.add(fn);
        return {
          data: {
            subscription: { unsubscribe: () => authListeners.delete(fn) },
          },
        };
      },
      signUp: async ({ email }: { email: string }) => {
        welcome(email);
        state.pendingEmail = email;
        persist();
        return { data: { session: null }, error: null };
      },
      signInWithPassword: async ({
        email,
        password,
      }: {
        email: string;
        password: string;
      }) => {
        const user = state.accounts[email];
        if (!user || password === "wrong-password")
          return {
            data: { session: null },
            error: { message: "Invalid login credentials" },
          };
        setUser(user);
        return { data: { session: state.session }, error: null };
      },
      signInWithOAuth: async ({ provider }: { provider: string }) => ({
        data: {
          url: `${location.origin}/auth/callback?${state.cancel ? "error=access_denied" : `code=oauth-${provider}-${Date.now()}`}`,
        },
        error: null,
      }),
      exchangeCodeForSession: async (code: string) => {
        if (state.used.includes(code))
          return {
            data: { session: null },
            error: { message: "Already used" },
          };
        state.used.push(code);
        const recovery = code.startsWith("recovery");
        const email = code.includes("google")
          ? "google@example.test"
          : code.includes("facebook")
            ? "facebook@example.test"
            : state.pendingEmail;
        if (!email)
          return {
            data: { session: null },
            error: { message: "Invalid code" },
          };
        if (recovery && !state.accounts[email])
          return {
            data: { session: null },
            error: { message: "Account not found" },
          };
        const user = welcome(email);
        if (code.includes("google")) {
          user.identities = [
            {
              provider: "google",
              id: "google-subject",
              identity_data: {
                full_name: "Google Test Runner",
                picture: "https://example.test/google-photo.png",
                email,
              },
            },
          ];
          user.app_metadata = { provider: "google" };
        }
        setUser(user, recovery ? "PASSWORD_RECOVERY" : "SIGNED_IN");
        return { data: { session: state.session }, error: null };
      },
      resetPasswordForEmail: async (email: string) => {
        state.pendingEmail = email;
        persist();
        return { data: {}, error: null };
      },
      resend: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: {}, error: null }),
      signOut: async () => {
        setUser(null, "SIGNED_OUT");
        return { error: null };
      },
      startAutoRefresh() {},
      stopAutoRefresh() {},
    },
    channel: () => {
      let listener: { filter: string; fn: () => void };
      const channel = {
        on: (_type: string, options: { filter: string }, fn: () => void) => {
          listener = { filter: options.filter, fn };
          channels.add(listener);
          return channel;
        },
        subscribe: (fn: (s: string) => void) => {
          fn("SUBSCRIBED");
          return channel;
        },
        unsubscribe: () => channels.delete(listener),
      };
      return channel;
    },
    removeChannel: async (channel: { unsubscribe: () => void }) => {
      channel.unsubscribe();
    },
    functions: {
      invoke: async () => {
        if (state.session) {
          const id = state.session.user.id;
          state.notifications = state.notifications.filter(
            (r: Row) => r.user_id !== id,
          );
          delete state.accounts[state.session.user.email];
          persist();
        }
        return { data: { deleted: true }, error: null };
      },
    },
  };
  (globalThis as unknown as { __authTest: unknown }).__authTest = {
    count: () => state.notifications.length,
    signOut: () => client.auth.signOut(),
    cancel: (value: boolean) => {
      state.cancel = value;
      persist();
    },
    offline: (value: boolean) => {
      state.fail = value;
      persist();
    },
    switchAccount: () => {
      setUser(welcome("second@example.test"));
    },
    insertUpdate: () => {
      if (!state.session) return;
      state.notifications.push({
        id: `update-${Date.now()}`,
        user_id: state.session.user.id,
        kind: "account",
        title: "Test account update",
        body: "Isolated Realtime fixture",
        created_at: new Date().toISOString(),
        read_at: null,
      });
      persist();
      channels.forEach((c) => c.fn());
    },
    snapshot: () => state,
  };
  exports.supabase = client;
  exports.backend = () => client;
  exports.storage = {
    getItem: async (k: string) => localStorage.getItem(`__phase6_meta:${k}`),
    setItem: async (k: string, v: string) =>
      localStorage.setItem(`__phase6_meta:${k}`, v),
    removeItem: async (k: string) =>
      localStorage.removeItem(`__phase6_meta:${k}`),
  };
  void emit; // Auth events occur only through the explicit fixture actions above.
}
