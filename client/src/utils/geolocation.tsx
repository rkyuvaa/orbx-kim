import React, { useEffect, useState } from 'react';
import { Box, Button, Tooltip, Typography } from '@mui/material';
import { ExternalLink, MapPin } from 'lucide-react';

const geocodeCache = new Map<string, string>();

/**
 * Reverse geocodes latitude and longitude into an Area and City string.
 * Uses in-memory caching to avoid redundant lookups.
 */
export async function reverseGeocodeAreaAndCity(
  lat: number,
  lng: number,
): Promise<{ area: string; city: string; formatted: string } | null> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    const cached = geocodeCache.get(cacheKey)!;
    const parts = cached.split(', ');
    return {
      area: parts[0] || '',
      city: parts[1] || parts[0] || '',
      formatted: cached,
    };
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};

    const area =
      addr.suburb ||
      addr.neighbourhood ||
      addr.residential ||
      addr.subdistrict ||
      addr.locality ||
      addr.road ||
      addr.village ||
      addr.hamlet ||
      '';

    const city =
      addr.city ||
      addr.town ||
      addr.municipality ||
      addr.city_district ||
      addr.state_district ||
      addr.county ||
      addr.state ||
      '';

    let formatted = '';
    if (area && city && area.toLowerCase() !== city.toLowerCase()) {
      formatted = `${area}, ${city}`;
    } else {
      formatted = area || city || '';
    }

    if (formatted) {
      geocodeCache.set(cacheKey, formatted);
      return { area, city, formatted };
    }
  } catch (err) {
    console.warn('Reverse geocode error:', err);
  }

  return null;
}

interface LocationDisplayProps {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  variant?: 'table' | 'card';
  showMapLink?: boolean;
}

export function LocationDisplay({
  lat,
  lng,
  address,
  variant = 'table',
  showMapLink = true,
}: LocationDisplayProps) {
  const [resolved, setResolved] = useState<string | null>(address || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (address && address.trim()) {
      setResolved(address);
      return;
    }

    if (lat && lng) {
      const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (geocodeCache.has(cacheKey)) {
        setResolved(geocodeCache.get(cacheKey)!);
        return;
      }

      setLoading(true);
      reverseGeocodeAreaAndCity(lat, lng)
        .then((res) => {
          if (res?.formatted) {
            setResolved(res.formatted);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [lat, lng, address]);

  if (!lat || !lng) {
    return (
      <Typography variant="caption" sx={{ color: '#94A3B8' }}>
        —
      </Typography>
    );
  }

  const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const displayText = resolved || (loading ? 'Locating area...' : `${lat.toFixed(4)}, ${lng.toFixed(4)}`);

  if (variant === 'table') {
    return (
      <Tooltip title={`GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)} • Click to open Google Maps`}>
        <Box
          component="a"
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.6,
            textDecoration: 'none',
            maxWidth: 180,
            py: 0.2,
            px: 0.8,
            borderRadius: '6px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #DBEAFE',
            '&:hover': {
              backgroundColor: '#DBEAFE',
            },
          }}
        >
          <MapPin size={12} color="#2563EB" style={{ flexShrink: 0 }} />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: '#1D4ED8',
              fontSize: 11,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayText}
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  // Card Variant (For Work Order detail modal)
  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: '#EFF6FF',
        borderRadius: '10px',
        border: '1px solid #DBEAFE',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            backgroundColor: '#DBEAFE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1D4ED8',
            flexShrink: 0,
          }}
        >
          <MapPin size={17} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              color: '#1E293B',
              fontSize: 13,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayText}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B', fontSize: 11, display: 'block' }}>
            GPS: {lat.toFixed(4)}, {lng.toFixed(4)}
          </Typography>
        </Box>
      </Box>

      {showMapLink && (
        <Button
          size="small"
          variant="outlined"
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          endIcon={<ExternalLink size={12} />}
          sx={{
            fontSize: 11.5,
            fontWeight: 600,
            textTransform: 'none',
            px: 1.5,
            py: 0.4,
            borderColor: '#BFDBFE',
            color: '#1D4ED8',
            backgroundColor: '#FFFFFF',
            borderRadius: '6px',
            '&:hover': {
              borderColor: '#2563EB',
              backgroundColor: '#F0F7FF',
            },
          }}
        >
          View Map
        </Button>
      )}
    </Box>
  );
}
