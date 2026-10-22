import { useEffect, useState } from "react";

const MOBILE_MQ = "(max-width: 1023px) and (pointer: coarse)";

export function useMobileUnsupported(): boolean {
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MQ);
    const update = () => setUnsupported(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return unsupported;
}
