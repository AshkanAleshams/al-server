import { useState } from 'react';
import { Button, TextField, Window, WindowHeader, WindowContent } from 'react95';
import { API_URL } from '../services/api';

const SubmitSong = () => {
  const [query, setQuery] = useState('');
  const [trackId, setTrackId] = useState('');
  const [songMetadata, setSongMetadata] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleQueryChange = (e) => setQuery(e.target.value);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();

      if (result.metadata) {
        // If metadata is returned, ask for confirmation
        setSongMetadata(result.metadata);
        setIsConfirming(true);
        setTrackId(result.metadata.trackId);
      } else if (result.success) {
        // If submission is successful
        alert('Song added successfully!');
        setQuery('');
        setSongMetadata(null);
        setIsConfirming(false);
      }
    } catch (error) {
      console.error('Error submitting song:', error);
    }
  };

  const handleConfirm = async () => {
    try {
      const response = await fetch(`${API_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trackId }),
      });

      const result = await response.json();

      if (result.success) {
        alert('Song added successfully!');
        setQuery('');
        setTrackId('');
        setSongMetadata(null);
        setIsConfirming(false);
      }
    } catch (error) {
      console.error('Error confirming song:', error);
    }
  };

  return (
    <Window style={{ width: 300, padding: '1rem' }}>
      <WindowHeader>Submit a Song</WindowHeader>
      <WindowContent>
        <form onSubmit={handleSubmit}>
          <TextField
            value={query}
            onChange={handleQueryChange}
            placeholder="Input search query or Spotify TrackID/Url"
            fullWidth
          />
          <Button type="submit">Submit</Button>
        </form>

        {isConfirming && songMetadata && (
          <div>
            <h3>Confirm Song</h3>
            <p>Title: {songMetadata.title}</p>
            <p>Artist: {songMetadata.artist}</p>
            <p>Album: {songMetadata.album}</p>
            <Button onClick={() => handleConfirm()}>Confirm</Button>
            <Button onClick={() => setIsConfirming(false)}>Cancel</Button>
          </div>
        )}
      </WindowContent>
    </Window>
  );
};

export default SubmitSong;
