import { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize2, SkipBack } from 'lucide-react'
import { cn, formatDuration } from '~/lib/utils'

interface VideoPlayerProps {
  lessonTitle: string
  duration: number
  maxAllowedPosition: number
  onTimeUpdate: (time: number) => void
  onComplete: () => void
  onSeekBlocked?: () => void
  seekToTime?: number | null
  autoPlay?: boolean
  minimized?: boolean
}

export function VideoPlayer({
  lessonTitle,
  duration,
  maxAllowedPosition,
  onTimeUpdate,
  onComplete,
  onSeekBlocked,
  seekToTime,
  autoPlay = false,
  minimized = false,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [currentTime, setCurrentTime] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [maxWatched, setMaxWatched] = useState(maxAllowedPosition)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (seekToTime !== null && seekToTime !== undefined) {
      setCurrentTime(seekToTime)
      setIsPlaying(true)
    }
  }, [seekToTime])

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.25
          if (next >= duration) {
            setIsPlaying(false)
            if (intervalRef.current) clearInterval(intervalRef.current)
            onComplete()
            return duration
          }
          if (next > maxWatched) {
            setMaxWatched(next)
          }
          onTimeUpdate(next)
          return next
        })
      }, 250)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, duration, maxWatched, onTimeUpdate, onComplete])

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percent = x / rect.width
      const targetTime = percent * duration

      if (targetTime > maxWatched + 1) {
        onSeekBlocked?.()
        setCurrentTime(maxWatched)
        return
      }

      setCurrentTime(Math.min(targetTime, maxWatched))
    },
    [duration, maxWatched, onSeekBlocked]
  )

  const togglePlay = useCallback(() => {
    if (currentTime >= duration) return
    setIsPlaying((p) => !p)
  }, [currentTime, duration])

  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
  }, [isPlaying])

  const skipBack10 = useCallback(() => {
    setCurrentTime((prev) => Math.max(0, prev - 10))
  }, [])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const watchedProgress = duration > 0 ? (maxWatched / duration) * 100 : 0

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-gray-900 transition-all duration-500 ease-out"
      style={{ height: minimized ? 200 : 'auto' }}
    >
      <div
        className={cn(
          'relative w-full cursor-pointer select-none',
          minimized ? 'aspect-auto h-[200px]' : 'aspect-video'
        )}
        onClick={togglePlay}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-gray-950">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                <Play className="h-7 w-7 text-white ml-1" />
              </div>
              {!minimized && (
                <p className="text-sm text-white/60">{lessonTitle}</p>
              )}
            </div>
          </div>

          {isPlaying && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-white/60 animate-audio-bar"
                      style={{
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300',
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div
              className="group relative mb-3 h-1.5 cursor-pointer rounded-full bg-white/20"
              onClick={(e) => {
                e.stopPropagation()
                handleSeek(e)
              }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                style={{ width: `${watchedProgress}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${progress}%`, marginLeft: -7 }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePlay()
                  }}
                  className="rounded-lg p-1.5 text-white hover:bg-white/10 transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    skipBack10()
                  }}
                  className="rounded-lg p-1.5 text-white hover:bg-white/10 transition-colors"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsMuted((m) => !m)
                  }}
                  className="rounded-lg p-1.5 text-white hover:bg-white/10 transition-colors"
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                <span className="ml-1 text-xs text-white/80">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>
              <button
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg p-1.5 text-white hover:bg-white/10 transition-colors"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
