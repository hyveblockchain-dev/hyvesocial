// src/components/GifPicker/GifPicker.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import './GifPicker.css';

const GIPHY_API_KEY = 'eM0YE7Q7YKqNpg5AqVjLTEYxI858iw9J';
const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search';
const GIPHY_TRENDING_URL = 'https://api.giphy.com/v1/gifs/trending';
const LIMIT = 20;

export default function GifPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const debounceRef = useRef(null);
  const gridRef = useRef(null);

  // Load trending on mount
  useEffect(() => {
    fetchTrending();
  }, []);

  async function fetchTrending() {
    setLoading(true);
    try {
      const res = await fetch(
        `${GIPHY_TRENDING_URL}?api_key=${GIPHY_API_KEY}&limit=${LIMIT}&offset=0&rating=pg-13`
      );
      const data = await res.json();
      setGifs(data.data || []);
      setOffset(LIMIT);
      setHasMore((data.pagination?.total_count || 0) > LIMIT);
    } catch (err) {
      console.error('GIPHY trending error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSearch(searchQuery, newOffset = 0, append = false) {
    if (!searchQuery.trim()) {
      fetchTrending();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${GIPHY_SEARCH_URL}?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchQuery)}&limit=${LIMIT}&offset=${newOffset}&rating=pg-13`
      );
      const data = await res.json();
      const results = data.data || [];
      setGifs(prev => append ? [...prev, ...results] : results);
      setOffset(newOffset + LIMIT);
      setHasMore((data.pagination?.total_count || 0) > newOffset + LIMIT);
    } catch (err) {
      console.error('GIPHY search error:', err);
    } finally {
      setLoading(false);
    }
  }

  // Debounced search
  const handleSearchChange = useCallback((value) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      setHasMore(true);
      fetchSearch(value, 0, false);
    }, 400);
  }, []);

  function handleLoadMore() {
    if (query.trim()) {
      fetchSearch(query, offset, true);
    } else {
      // load more trending
      setLoading(true);
      fetch(`${GIPHY_TRENDING_URL}?api_key=${GIPHY_API_KEY}&limit=${LIMIT}&offset=${offset}&rating=pg-13`)
        .then(r => r.json())
        .then(data => {
          setGifs(prev => [...prev, ...(data.data || [])]);
          setOffset(prev => prev + LIMIT);
          setHasMore((data.pagination?.total_count || 0) > offset + LIMIT);
        })
        .catch(err => console.error('GIPHY load more error:', err))
        .finally(() => setLoading(false));
    }
  }

  function handleSelect(gif) {
    // Pass the best quality URL and a smaller preview
    const url = gif.images?.original?.url || gif.images?.downsized_medium?.url || gif.images?.fixed_height?.url;
    const previewUrl = gif.images?.fixed_height_small?.url || gif.images?.fixed_height?.url || url;
    onSelect({ url, previewUrl, title: gif.title || 'GIF' });
  }

  return (
    <div className="gif-picker">
      <div className="gif-picker-header">
        <input
          type="text"
          className="gif-search-input"
          placeholder="Search GIFs..."
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          autoFocus
        />
        {onClose && (
          <button type="button" className="gif-picker-close" onClick={onClose}>✕</button>
        )}
      </div>

      <div className="gif-grid" ref={gridRef}>
        {gifs.map((gif) => (
          <button
            key={gif.id}
            type="button"
            className="gif-item"
            onClick={() => handleSelect(gif)}
            title={gif.title}
          >
            <img
              src={gif.images?.fixed_height_small?.url || gif.images?.fixed_height?.url}
              alt={gif.title || 'GIF'}
              loading="lazy"
            />
          </button>
        ))}
        {gifs.length === 0 && !loading && (
          <div className="gif-empty">No GIFs found</div>
        )}
      </div>

      {loading && <div className="gif-loading">Loading...</div>}

      {hasMore && !loading && gifs.length > 0 && (
        <button type="button" className="gif-load-more" onClick={handleLoadMore}>
          Load more
        </button>
      )}

      <div className="gif-powered-by">Powered by GIPHY</div>
    </div>
  );
}
