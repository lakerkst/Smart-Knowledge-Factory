import { useRef, useEffect, useState, useCallback } from 'react'
import type Player from '@vimeo/player'
import { Play, Pause, RotateCcw, Volume2, VolumeX, Video, AlertCircle } from 'lucide-react'
import { cn, formatDuration } from '~/lib/utils'

interface VideoPlayerProps {
  vimeoId: string | null | undefined
  lessonTitle: string
  duration: number
  maxAllowedPosition: number
  onTimeUpdate: (time: number) => void
  onComplete: () => void
  onSeekBlocked?: () => void
  seekToTime?: number | null
  minimized?: boolean
  paused?: boolean
}

export function VideoPlayer({
  vimeoId,
  lessonTitle,
  duration,
  maxAllowedPosition,
  onTimeUpdate,
  onComplete,
  onSeekBlocked,
  seekToTime,
  minimized = false,
  paused = false,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<InstanceType<typeof Player> | null>(null)
  const maxWatchedRef = useRef(maxAllowedPosition)
  // Prevents paused→play effect from firing play() while a seek is in flight
  const pendingSeekRef = useRef(false)

  // Keep callback refs fresh so Vimeo event handlers (set up once in [vimeoId]
  // effect) always call the latest version — avoids stale-closure bugs.
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onCompleteRef = useRef(onComplete)
  const onSeekBlockedRef = useRef(onSeekBlocked)
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate }, [onTimeUpdate])
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => { onSeekBlockedRef.current = onSeekBlocked }, [onSeekBlocked])

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(maxAllowedPosition)
  const [maxWatched, setMaxWatched] = useState(maxAllowedPosition)
  const [isMuted, setIsMuted] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Keep maxWatchedRef in sync for use inside event handlers
  useEffect(() => {
    maxWatchedRef.current = maxWatched
  }, [maxWatched])

  // Initialize Vimeo player
  useEffect(() => {
    if (!containerRef.current || !vimeoId) return

    let destroyed = false
    let player: InstanceType<typeof Player>

    const timeoutId = setTimeout(() => {
      if (!destroyed && !playerRef.current) {
        setIsReady(true)
        setLoadError(true)
      }
    }, 15000)

    import('@vimeo/player').then(({ default: VimeoPlayer }) => {
      if (destroyed || !containerRef.current) return

      try {
        player = new VimeoPlayer(containerRef.current, {
          id: parseInt(vimeoId),
          responsive: true,
          controls: false,
          autopause: false,
          title: false,
          byline: false,
          portrait: false,
          dnt: true,
        })

        player.ready().then(async () => {
          if (destroyed) return
          clearTimeout(timeoutId)
          if (maxAllowedPosition > 0) {
            await player.setCurrentTime(maxAllowedPosition)
          }
          setIsReady(true)
          playerRef.current = player
        }).catch(() => {
          if (!destroyed) {
            clearTimeout(timeoutId)
            setIsReady(true)
            setLoadError(true)
          }
        })

        player.on('timeupdate', ({ seconds }: { seconds: number }) => {
          setCurrentTime(seconds)
          if (seconds > maxWatchedRef.current) {
            maxWatchedRef.current = seconds
            setMaxWatched(seconds)
          }
          onTimeUpdateRef.current(seconds)
        })

        player.on('play', () => setIsPlaying(true))
        player.on('pause', () => setIsPlaying(false))

        player.on('ended', () => {
          setIsPlaying(false)
          onCompleteRef.current()
        })

        // Block forward seeking beyond maxWatched
        player.on('seeked', ({ seconds }: { seconds: number }) => {
          if (seconds > maxWatchedRef.current + 1) {
            player.setCurrentTime(maxWatchedRef.current)
            onSeekBlockedRef.current?.()
          }
        })

        player.on('error', () => {
          clearTimeout(timeoutId)
          if (!destroyed) {
            setIsReady(true)
            setLoadError(true)
          }
        })
      } catch {
        clearTimeout(timeoutId)
        setIsReady(true)
        setLoadError(true)
      }
    }).catch(() => {
      clearTimeout(timeoutId)
      if (!destroyed) {
        setIsReady(true)
        setLoadError(true)
      }
    })

    return () => {
      destroyed = true
      clearTimeout(timeoutId)
      player?.destroy().catch(() => {})
      playerRef.current = null
      setIsReady(false)
      setLoadError(false)
      setIsPlaying(false)
      setCurrentTime(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vimeoId])

  // Pause/resume when quiz overlay is active.
  // Skip auto-play when a seek is in flight — seekToTime effect owns play() in that case.
  useEffect(() => {
    if (!playerRef.current) return
    if (paused) {
      playerRef.current.pause()
    } else if (!pendingSeekRef.current) {
      playerRef.current.play().catch(() => {})
    }
  }, [paused])

  // Seek to specific time (replay on wrong answer).
  // Sets pendingSeekRef so the paused effect won't race with us.
  useEffect(() => {
    if (seekToTime === null || seekToTime === undefined || !playerRef.current) return
    pendingSeekRef.current = true
    playerRef.current.setCurrentTime(seekToTime).then(() => {
      pendingSeekRef.current = false
      playerRef.current?.play().catch(() => {})
    }).catch(() => {
      pendingSeekRef.current = false
    })
  }, [seekToTime])

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return
    if (isPlaying) {
      playerRef.current.pause()
    } else {
      playerRef.current.play()
    }
  }, [isPlaying])

  const skipBack10 = useCallback(() => {
    if (!playerRef.current) return
    playerRef.current.getCurrentTime().then((t: number) => {
      playerRef.current!.setCurrentTime(Math.max(0, t - 10))
    })
  }, [])

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return
    playerRef.current.setVolume(isMuted ? 1 : 0)
    setIsMuted((m) => !m)
  }, [isMuted])

  // Shared seek logic for click and touch
  const seekToPercent = useCallback(
    (clientX: number, rect: DOMRect) => {
      if (!playerRef.current) return
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const targetTime = percent * duration
      if (targetTime > maxWatchedRef.current + 1) {
        onSeekBlocked?.()
        return
      }
      playerRef.current.setCurrentTime(Math.min(targetTime, maxWatchedRef.current))
    },
    [duration, onSeekBlocked]
  )

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      seekToPercent(e.clientX, e.currentTarget.getBoundingClientRect())
    },
    [seekToPercent]
  )

  const handleProgressTouch = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0] ?? e.changedTouches[0]
      if (!touch) return
      seekToPercent(touch.clientX, e.currentTarget.getBoundingClientRect())
    },
    [seekToPercent]
  )

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const watchedPercent = duration > 0 ? (maxWatched / duration) * 100 : 0

  // No vimeoId — placeholder
  if (!vimeoId) {
    return (
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-gray-950 flex flex-col items-center justify-center gap-3">
        <Video className="h-10 w-10 text-white/20" />
        <p className="text-sm text-white/30">Видео не прикреплено</p>
      </div>
    )
  }

  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-gray-950">
      {/* Vimeo iframe */}
      <div
        ref={containerRef}
        className="absolute inset-0 [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:h-full [&>iframe]:w-full"
      />

      {/* Blocks Vimeo native controls so our custom UI takes over */}
      <div className="absolute inset-0 z-10" />

      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-gray-950">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-white/50">{lessonTitle}</p>
          <p className="text-xs text-white/25">Загрузка видео...</p>
        </div>
      )}

      {/* Error overlay */}
      {isReady && loadError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-gray-950">
          <AlertCircle className="h-10 w-10 text-white/30" />
          <p className="text-sm text-white/50">Видео недоступно</p>
          <p className="text-xs text-white/25 text-center max-w-xs px-4">
            Проверьте Vimeo ID урока или доступность видео
          </p>
        </div>
      )}

      {/* Cover overlay: shown when ready but not playing — title + duration + big center play */}
      {isReady && !loadError && !isPlaying && (
        <div
          className="absolute inset-0 z-[15] flex flex-col items-center justify-center gap-4 bg-black/60 px-6 cursor-pointer"
          onClick={togglePlay}
        >
          {/* Lesson info */}
          <div className="text-center">
            <p className="text-base font-semibold text-white leading-snug line-clamp-3">
              {lessonTitle}
            </p>
            {duration > 0 && (
              <p className="mt-1.5 text-sm text-white/50">{formatDuration(duration)}</p>
            )}
          </div>

          {/* Big centered play button */}
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 border border-white/30 backdrop-blur-sm">
            <Play className="h-9 w-9 text-white" style={{ marginLeft: '4px' }} />
          </div>
        </div>
      )}

      {/* Bottom controls — always visible over video */}
      {isReady && !loadError && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pb-3 pt-12">

          {/* Progress bar — tall touch target, finger-draggable */}
          <div
            className="group relative mb-3 flex cursor-pointer items-center"
            style={{ height: '24px' }}
            onClick={handleProgressClick}
            onTouchStart={handleProgressTouch}
            onTouchMove={handleProgressTouch}
          >
            {/* Track */}
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/25 overflow-hidden">
              {/* Watched zone */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/40"
                style={{ width: `${watchedPercent}%` }}
              />
              {/* Played zone */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Thumb — visible on hover/active */}
            <div
              className={cn(
                'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-md transition-opacity',
                'opacity-0 group-hover:opacity-100 group-active:opacity-100'
              )}
              style={{ left: `calc(${progressPercent}% - 10px)` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-0.5">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="rounded-xl p-2.5 text-white active:bg-white/20"
            >
              {isPlaying
                ? <Pause className="h-5 w-5" />
                : <Play className="h-5 w-5" />}
            </button>

            {/* Rewind 10s — icon + label for clarity */}
            <button
              onClick={skipBack10}
              className="flex items-center gap-0.5 rounded-xl px-2 py-2.5 text-white active:bg-white/20"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="text-xs font-medium leading-none">10</span>
            </button>

            {/* Mute */}
            <button
              onClick={toggleMute}
              className="rounded-xl p-2.5 text-white active:bg-white/20"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>

            {/* Time */}
            <span className="ml-auto text-xs text-white/70 tabular-nums">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
