import { expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { profileDetailsQuery } from "../services/profile-details-query";
const load = vi.hoisted(() => vi.fn());
vi.mock("../services/profile-details", () => ({ loadProfileDetails: load }));
it("reuses fresh cached details and isolates accounts without placeholder data", async () => {
  const client = new QueryClient();
  const row = {
    first_name: "Maya",
    last_name: "Sherpa",
    city: "Kathmandu",
    province: "Bagmati",
    primary_sport: null,
    birthdate: null,
    gender: null,
    weight_kg: null,
    revision: 1,
  };
  client.setQueryData(profileDetailsQuery("owner").queryKey, row);
  load.mockReset().mockResolvedValue(null);
  expect(await client.fetchQuery(profileDetailsQuery("owner"))).toBe(row);
  expect(load).not.toHaveBeenCalled();
  expect(
    client.getQueryData(profileDetailsQuery("other").queryKey),
  ).toBeUndefined();
  expect(await client.fetchQuery(profileDetailsQuery("other"))).toBeNull();
  expect(load).toHaveBeenCalledWith("other");
  client.clear();
});
it("deduplicates simultaneous cold requests from the screen and editor", async () => {
  const client = new QueryClient();
  let finish!: (value: null) => void;
  load.mockReset().mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const screen = client.fetchQuery(profileDetailsQuery("owner"));
  const editor = client.fetchQuery(profileDetailsQuery("owner"));
  expect(load).toHaveBeenCalledOnce();
  finish(null);
  expect(await screen).toBeNull();
  expect(await editor).toBeNull();
  client.clear();
});
it("retains data while a stale background refresh is pending and after failure", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const options = profileDetailsQuery("owner");
  const row = {
    first_name: "Maya",
    last_name: "Sherpa",
    city: "Kathmandu",
    province: "Bagmati",
    primary_sport: null,
    birthdate: null,
    gender: null,
    weight_kg: null,
    revision: 1,
  };
  client.setQueryData(options.queryKey, row, { updatedAt: 1 });
  let fail!: (error: Error) => void;
  load.mockReset().mockImplementation(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  expect(observer.getCurrentResult().data).toBe(row);
  expect(observer.getCurrentResult().isPending).toBe(false);
  const request = observer.refetch();
  fail(new Error("offline"));
  await request;
  expect(observer.getCurrentResult().data).toBe(row);
  expect(observer.getCurrentResult().isError).toBe(true);
  unsubscribe();
  client.clear();
});
