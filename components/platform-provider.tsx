"use client";
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  X,
} from "lucide-react";
import { translations, type TranslationKey } from "@/lib/translations";
import type { PublicTrack } from "@/lib/public-data";
type Language = "EN" | "ST";
const languageListeners = new Set<() => void>();
function subscribe(listener: () => void) {
  languageListeners.add(listener);
  return () => {
    languageListeners.delete(listener);
  };
}
const languageSnapshot = (): Language =>
  typeof window !== "undefined" && localStorage.getItem("ad-language") === "ST"
    ? "ST"
    : "EN";
const Context = createContext<{
  lang: Language;
  t: (key: TranslationKey) => string;
  setLang: (lang: Language) => void;
  tracks: PublicTrack[];
  playTrack: (track: PublicTrack) => void;
  current: PublicTrack | null;
  playing: boolean;
} | null>(null);
export function usePlatform() {
  const value = useContext(Context);
  if (!value) throw new Error("Platform provider required");
  return value;
}
const format = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export function PlatformProvider({
  children,
  tracks,
}: {
  children: ReactNode;
  tracks: PublicTrack[];
}) {
  const lang = useSyncExternalStore(
    subscribe,
    languageSnapshot,
    () => "EN" as Language,
  );
  const [current, setCurrent] = useState<PublicTrack | null>(null),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [volume, setVolume] = useState(0.6),
    [muted, setMuted] = useState(false),
    [queue, setQueue] = useState(false),
    [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!audio.current || !current) return;
    audio.current.load();
    audio.current
      .play()
      .catch(() => setError("Audio could not be played. Please try again."));
  }, [current]);
  useEffect(() => {
    document.documentElement.setAttribute("lang", lang === "EN" ? "en" : "st");
  }, [lang]);
  useEffect(() => {
    if (audio.current) {
      audio.current.volume = volume;
      audio.current.muted = muted;
    }
  }, [volume, muted]);
  const setLang = (language: Language) => {
    localStorage.setItem("ad-language", language);
    languageListeners.forEach((fn) => fn());
  };
  const toggle = () => {
    if (!audio.current) return;
    if (audio.current.paused)
      audio.current.play().catch(() => setError("Audio could not be played."));
    else audio.current.pause();
  };
  const playTrack = (track: PublicTrack) => {
    setError("");
    if (current?.id === track.id) toggle();
    else setCurrent(track);
  };
  const move = (direction: number) => {
    if (!current) return;
    const i = tracks.findIndex((t) => t.id === current.id);
    setCurrent(tracks[(i + direction + tracks.length) % tracks.length]);
  };
  return (
    <Context.Provider
      value={{
        lang,
        t: (key) => translations[lang][key],
        setLang,
        tracks,
        playTrack,
        current,
        playing,
      }}
    >
      {children}
      <audio
        ref={audio}
        src={current?.previewUrl}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setTime(audio.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audio.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        onError={() => current && setError("This preview is unavailable.")}
      />
      {current && (
        <aside className="mini-player" aria-label="Music player">
          <div className="player-track">
            <img src={current.artwork} alt="" />
            <div>
              <strong>{current.title}</strong>
              <span>{current.artist} · Preview</span>
            </div>
          </div>
          <div className="player-main">
            <div className="player-buttons">
              <button
                className="icon-button"
                aria-label="Previous track"
                title="Previous track"
                onClick={() => move(-1)}
              >
                <SkipBack size={17} />
              </button>
              <button
                className="player-play"
                aria-label={playing ? "Pause" : "Play"}
                onClick={toggle}
              >
                {playing ? <Pause size={19} /> : <Play size={19} />}
              </button>
              <button
                className="icon-button"
                aria-label="Next track"
                title="Next track"
                onClick={() => move(1)}
              >
                <SkipForward size={17} />
              </button>
            </div>
            <div className="seek">
              <span>{format(time)}</span>
              <input
                aria-label="Seek"
                type="range"
                min={0}
                max={duration || 1}
                step={0.1}
                value={Math.min(time, duration || 1)}
                onChange={(e) => {
                  if (audio.current)
                    audio.current.currentTime = Number(e.target.value);
                }}
              />
              <span>{format(duration)}</span>
            </div>
            {error && (
              <span role="alert" className="error">
                {error}
              </span>
            )}
          </div>
          <div className="player-tools">
            <button
              className="icon-button"
              aria-label="Playlist"
              title="Playlist"
              onClick={() => setQueue(!queue)}
            >
              <ListMusic size={19} />
            </button>
            <button
              className="icon-button"
              aria-label={muted ? "Unmute" : "Mute"}
              title={muted ? "Unmute" : "Mute"}
              onClick={() => {
                setMuted(!muted);
                if (audio.current) audio.current.muted = !muted;
              }}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              aria-label="Volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (audio.current) audio.current.volume = v;
              }}
            />
            <button
              className="icon-button"
              aria-label="Close player"
              title="Close player"
              onClick={() => {
                audio.current?.pause();
                setCurrent(null);
              }}
            >
              <X size={18} />
            </button>
          </div>
          {queue && (
            <div className="player-queue">
              {tracks.map((t) => (
                <button key={t.id} onClick={() => playTrack(t)}>
                  <ListMusic size={16} />
                  {t.title}
                </button>
              ))}
            </div>
          )}
        </aside>
      )}
    </Context.Provider>
  );
}
