import { useEffect } from 'react'

/**
 * Cesium canvas가 viewport 전체로 그려지는 문제 방지.
 * map 컨테이너 크기를 px로 고정하고 viewer.resize() 호출.
 */
export default function useMapLayout(mapContainerRef, viewerRef, isViewerReady = false) {
  useEffect(() => {
    const container = mapContainerRef.current
    const stage = container?.parentElement
    if (!container || !stage) return undefined

    const applySize = () => {
      const width = stage.clientWidth
      const height = stage.clientHeight
      if (width <= 0 || height <= 0) return

      container.style.width = `${width}px`
      container.style.height = `${height}px`

      const viewer = viewerRef.current
      if (viewer && !viewer.isDestroyed?.()) {
        viewer.resize()
        viewer.scene.requestRender()
      }
    }

    applySize()

    const observer = new ResizeObserver(applySize)
    observer.observe(stage)

    window.addEventListener('resize', applySize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', applySize)
    }
  }, [mapContainerRef, viewerRef, isViewerReady])
}
