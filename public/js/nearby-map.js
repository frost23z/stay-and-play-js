// Google Maps integration for the Nearby Properties section.
// Handles: loading the Maps JS API on demand, rendering one pin per
// property, and syncing hover/click state with the property cards.

const DEFAULT_COLOR = '#d64545' // bold red — reads clearly against map terrain/water colors
const ACTIVE_COLOR = cssVar('--color-dark-green', '#222f24') // matches .property-card--active
const DEFAULT_SCALE = 1.5
const ACTIVE_SCALE = 2

// Simple teardrop pin, drawn in a 24x24 box, anchored at its bottom tip.
const PIN_PATH =
    'M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.5 8.5 15.5 8.5 15.5s8.5-9 8.5-15.5C20.5 3.81 16.69 0 12 0zm0 12a3.5 3.5 0 110-7 3.5 3.5 0 010 7z'

function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return value || fallback
}

let map = null
const markers = new Map() // property ID -> google.maps.marker.AdvancedMarkerElement
let activeId = null
let handlers = {}

// Populated by loadGoogleMaps() once the "marker" library resolves.
let AdvancedMarkerElement = null

/**
 * Loads the Maps JS API once, using the key injected server-side into
 * window.__ENV__ (see src/routes/env.js). Safe to call multiple times —
 * only the first call actually injects the script.
 */
export function loadGoogleMaps() {
    if (window.google?.maps && AdvancedMarkerElement) return Promise.resolve(window.google)
    if (window.__googleMapsLoading) return window.__googleMapsLoading

    window.__googleMapsLoading = new Promise((resolve, reject) => {
        const key = window.__ENV__?.GOOGLE_MAPS_API_KEY
        if (!key) {
            reject(
                new Error(
                    'Missing Google Maps API key — set GOOGLE_MAPS_API_KEY in your .env file.'
                )
            )
            return
        }

        // Google calls this global if the key is invalid, restricted to the
        // wrong referrer, or billing isn't enabled on the project. Without
        // this hook that failure is silent — you just get a grey/broken map
        // with no markers and no console error, which is the #1 cause of
        // "map renders but nothing works".
        window.gm_authFailure = () => {
            reject(
                new Error(
                    'Google Maps rejected the API key (invalid, restricted, or billing not enabled).'
                )
            )
        }

        window.__onGoogleMapsLoaded = async () => {
            delete window.__onGoogleMapsLoaded
            try {
                // Marker isn't preloaded by the base script — request it once
                // core has finished loading.
                ;({ AdvancedMarkerElement } = await google.maps.importLibrary('marker'))
                resolve(window.google)
            } catch (err) {
                reject(err)
            }
        }

        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__onGoogleMapsLoaded`
        script.async = true
        script.onerror = () =>
            reject(new Error('Failed to load the Google Maps script (network/ad-blocker?).'))
        document.head.appendChild(script)
    })

    return window.__googleMapsLoading
}

export function initNearbyMap(container) {
    map = new google.maps.Map(container, {
        zoom: 10,
        center: { lat: 28.4, lng: -81.3 }, // re-centered once real markers land
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        // Required by AdvancedMarkerElement. "DEMO_MAP_ID" only works for
        // local testing — create a real map ID in Cloud Console for prod.
        mapId: window.__ENV__?.GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
    })
    // Guards against the container having been 0-height for the very
    // first layout pass (e.g. web fonts/images still loading above it) —
    // without this, Maps can cache a broken tile/marker coordinate space.
    requestAnimationFrame(() => google.maps.event.trigger(map, 'resize'))
    return map
}

/**
 * @param {{onHover?: (id: string) => void, onLeave?: (id: string) => void, onClick?: (id: string) => void}} callbacks
 */
export function setNearbyMapHandlers(callbacks) {
    handlers = callbacks || {}
}

export function renderMarkers(items) {
    clearMarkers()
    if (!map || !items?.length) return

    // Force Maps to re-measure its container before we compute a camera fit
    // against it — if this container's size just settled (e.g. right after
    // the card grid's innerHTML was set), fitBounds can otherwise frame the
    // OLD, stale size and leave markers just outside the visible viewport.
    google.maps.event.trigger(map, 'resize')

    const bounds = new google.maps.LatLngBounds()
    let skipped = 0

    items.forEach((item) => {
        const geo = item.GeoInfo || {}
        const lat = Number(geo.Lat)
        const lng = Number(geo.Lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            skipped += 1
            return
        }

        const id = String(item.ID || '')
        const position = { lat, lng }

        const marker = new AdvancedMarkerElement({
            map,
            position,
            title: item.Property?.PropertyName || '',
            content: pinElement(DEFAULT_COLOR, DEFAULT_SCALE),
            gmpClickable: true,
        })

        // AdvancedMarkerElement is a real DOM node, so plain DOM events work.
        // mouseenter/mouseleave (rather than mouseover/mouseout) don't bubble
        // from the pin's inner SVG, so hover state can't flicker on entry.
        marker.addEventListener('mouseenter', () => {
            setMarkerVisual(id, true)
            handlers.onHover?.(id)
        })
        marker.addEventListener('mouseleave', () => {
            if (activeId !== id) setMarkerVisual(id, false)
            handlers.onLeave?.(id)
        })
        // Click uses the 'gmp-click' event (requires gmpClickable: true above)
        // rather than the legacy 'click' event.
        marker.addEventListener('gmp-click', () => {
            activeId = activeId === id ? null : id
            markers.forEach((_, markerId) => setMarkerVisual(markerId, markerId === activeId))
            handlers.onClick?.(id)
        })

        markers.set(id, marker)
        bounds.extend(position)
    })

    console.debug(
        `[nearby-map] plotted ${markers.size} marker(s), skipped ${skipped} (missing coordinates)`
    )

    if (markers.size === 1) {
        map.setCenter(bounds.getCenter())
        map.setZoom(14)
    } else if (markers.size > 1) {
        map.fitBounds(bounds, 48)
    }
}

/** Called from nearby-properties.js when a card is hovered/unhovered. */
export function highlightMarker(id, isActive) {
    setMarkerVisual(id, isActive)
    if (isActive) {
        const marker = markers.get(id)
        if (marker) map.panTo(marker.position)
    }
}

export function resizeNearbyMap() {
    if (!map) return
    google.maps.event.trigger(map, 'resize')
}

function setMarkerVisual(id, isActive) {
    const marker = markers.get(id)
    if (!marker) return
    marker.content = pinElement(
        isActive ? ACTIVE_COLOR : DEFAULT_COLOR,
        isActive ? ACTIVE_SCALE : DEFAULT_SCALE
    )
    marker.zIndex = isActive ? 999 : 1
}

function clearMarkers() {
    markers.forEach((marker) => (marker.map = null))
    markers.clear()
    activeId = null
}

// Builds a teardrop pin as an SVG DOM node for AdvancedMarkerElement's
// `content`. Advanced markers anchor content at its bottom-center by
// default, which matches the pin's tip.
function pinElement(color, scale) {
    const size = 24 * scale
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="${PIN_PATH}" fill="${color}" stroke="#ffffff" stroke-width="1.5"></path>
        </svg>
    `
    return wrapper.firstElementChild
}
