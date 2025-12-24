import { useEffect, useRef } from "react";

export function useMounted(): React.MutableRefObject<boolean> {
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return mountedRef;
}
