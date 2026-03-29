import { useEffect, useRef, useState } from "react";
import handpanPreview from "../assets/handpan-preview.mp3";

export default function GlobalAudioPlayer() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.85;

    const tryAutoplay = async () => {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        setIsPlaying(false);
        console.warn("Autoplay blocked by browser:", error);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    tryAutoplay();

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        console.error("Manual play failed:", error);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  return (
    <>
      <audio ref={audioRef} src={handpanPreview} loop preload="auto" />

      <button
        type="button"
        onClick={toggleAudio}
        aria-label={isPlaying ? "Pause music" : "Play music"}
        className={`
          fixed left-5 bottom-5 z-[9999]
          inline-flex items-center gap-[10px]
          rounded-full border-0
          px-4 py-3
          cursor-pointer
          shadow-[0_12px_30px_rgba(0,0,0,0.25)]
          backdrop-blur-[10px]
          transition-all duration-200 ease-in-out
          hover:-translate-y-[2px]
          ${isPlaying ? "bg-[#E67E22] text-[#111]" : "bg-[rgba(20,20,20,0.85)] text-white"}
          max-sm:left-auto max-sm:right-[14px] max-sm:bottom-[14px] max-sm:px-[14px] max-sm:py-[10px]
        `}
      >
        <span
          className="
            inline-grid place-items-center
            w-6 h-6
            text-[16px] font-bold
          "
        >
          {isPlaying ? "❚❚" : "♪"}
        </span>

        <span className="text-[14px] font-semibold tracking-[0.02em] max-sm:text-[13px]">
          {isPlaying ? "Music On" : "Music Off"}
        </span>
      </button>
    </>
  );
}