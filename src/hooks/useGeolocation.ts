import { useState, useCallback } from 'react';

interface GeoLocation {
  lat: number;
  lon: number;
  accuracy: number;
}

interface UseGeolocationReturn {
  location: GeoLocation | null;
  error: string | null;
  loading: boolean;
  getLocation: () => Promise<GeoLocation | null>;
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(async (): Promise<GeoLocation | null> => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada pelo navegador');
      return null;
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: GeoLocation = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setLocation(loc);
          setLoading(false);
          resolve(loc);
        },
        (err) => {
          let errorMessage = 'Erro ao obter localização';
          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMessage = 'Permissão de localização negada';
              break;
            case err.POSITION_UNAVAILABLE:
              errorMessage = 'Localização indisponível';
              break;
            case err.TIMEOUT:
              errorMessage = 'Tempo limite excedido';
              break;
          }
          setError(errorMessage);
          setLoading(false);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }, []);

  return { location, error, loading, getLocation };
}
