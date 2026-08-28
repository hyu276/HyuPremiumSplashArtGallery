'use client';

import { useMemo, useState } from 'react';

type MinigameArtwork = {
  id: string;
  image: string;
  category: string;
};

type Props = {
  artworks: MinigameArtwork[];
};

function randomIndex(length: number, previousIndex: number | null) {
  if (length <= 1) return 0;
  let next = Math.floor(Math.random() * length);
  while (next === previousIndex) next = Math.floor(Math.random() * length);
  return next;
}

export default function MinigameClient({ artworks }: Props) {
  const availableArtworks = useMemo(
    () => artworks.filter((artwork) => Boolean(artwork.image && artwork.category)),
    [artworks],
  );
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const currentArtwork = currentIndex === null ? null : availableArtworks[currentIndex];

  function rollArtwork() {
    setCurrentIndex((previous) => randomIndex(availableArtworks.length, previous));
    setRevealed(false);
  }

  if (availableArtworks.length === 0) {
    return <p className="minigame-empty">Hiện chưa có artwork khả dụng cho minigame.</p>;
  }

  return (
    <div className="minigame-game">
      <div className={`minigame-stage${currentArtwork ? ' is-active' : ''}`}>
        {currentArtwork ? (
          <img
            key={currentArtwork.id}
            src={currentArtwork.image}
            alt="Artwork bí ẩn trong HYU PREMIUM"
            className="minigame-artwork"
            decoding="async"
          />
        ) : (
          <div className="minigame-placeholder" aria-hidden="true">
            <span>?</span>
            <p>Nhấn Roll để bắt đầu</p>
          </div>
        )}
      </div>

      <div className="minigame-actions">
        <button className="minigame-button minigame-button-primary" type="button" onClick={rollArtwork}>
          {currentArtwork ? 'Roll artwork khác' : 'Roll artwork'}
        </button>
        <button
          className="minigame-button minigame-button-secondary"
          type="button"
          onClick={() => setRevealed(true)}
          disabled={!currentArtwork || revealed}
        >
          Reveal answer
        </button>
      </div>

      <div className={`minigame-answer${revealed ? ' is-visible' : ''}`} aria-live="polite">
        {revealed && currentArtwork ? (
          <>
            <span>Đáp án</span>
            <strong>{currentArtwork.category}</strong>
          </>
        ) : (
          <span className="minigame-answer-hint">Đoán category trước khi mở đáp án.</span>
        )}
      </div>
    </div>
  );
}
