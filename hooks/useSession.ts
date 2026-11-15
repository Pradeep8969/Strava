import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";
const SessionContext = createContext<{
  session: Session | null;
  loading: boolean;
}>({ session: null, loading: true });
export function SessionProvider({ children }: PropsWithChildren) {
  const client = useQueryClient();
  const [state, setState] = useState<{
    session: Session | null;
    loading: boolean;
  }>({ session: null, loading: !!supabase });
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    let observedEvent = false;
    let previousUserId: string | undefined;
    const update = (session: Session | null) => {
      if (previousUserId && previousUserId !== session?.user.id) {
        client.removeQueries({
          predicate: (query) =>
            ["athlete-profile", "athlete-avatar", "athlete-details"].includes(
              String(query.queryKey[0]),
            ) && query.queryKey[1] === previousUserId,
        });
      }
      previousUserId = session?.user.id;
      setState({ session, loading: false });
    };
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted && !observedEvent) update(data.session);
      })
      .catch(() => {
        if (mounted && !observedEvent) update(null);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, current) => {
      observedEvent = true;
      if (mounted) update(current);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [client]);
  return createElement(SessionContext.Provider, { value: state }, children);
}
export const useAuthSession = () => useContext(SessionContext);
export const useSession = () => useAuthSession().session;
