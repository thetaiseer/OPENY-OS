'use client';

export function AssetAudioPlayer({ url, onError }: { url: string; onError: () => void }) {
  return (
    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-5">
      <audio className="w-full" controls preload="metadata" onError={onError}>
        <source src={url} />
      </audio>
    </div>
  );
}
