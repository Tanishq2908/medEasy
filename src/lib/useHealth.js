import { useEffect, useState } from 'react';
import { api } from '../api';

let cached = null;

export function useHealth() {
  const [health, setHealth] = useState(cached);
  useEffect(() => {
    if (cached) return;
    api('/api/health').then((d) => { cached = d; setHealth(d); }).catch(() => setHealth({ status: 'down' }));
  }, []);
  return health;
}
