import { useEffect, useState } from 'react';
import { fetchLampangBoundaries } from '../services/lampangBoundaryService';
let shared = null;
export default function useLampangBoundaries() {
  const [state, setState] = useState({ features: [], loading: true, error: '', source: '' });
  useEffect(() => {
    let active = true;
    if (!shared) shared = fetchLampangBoundaries().catch(err => { shared = null; throw err; });
    shared.then(({ features, url }) => {
      if (active) setState({ features, loading: false, error: '', source: url });
    }).catch(err => {
      if (active) setState({ features: [], loading: false, error: err.message, source: '' });
    });
    return () => { active = false; };
  }, []);
  return state;
}
