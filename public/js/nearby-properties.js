import {
    highlightMarker,
    initNearbyMap,
    loadGoogleMaps,
    renderMarkers,
    resizeNearbyMap,
    setNearbyMapHandlers,
} from './nearby-map.js'

const IMG_BASE_URL = 'https://beta.imgservice.rentbyowner.com/640x300/'
const MOBILE_QUERY = '(max-width: 767px)'
const LIMITS = { desktop: 6, mobile: 4 }
const FAVORITES_KEY = 'favoriteProperties'

const SORT_PARAMS = {
    'most-popular': 'most-popular',
    'highest-price': 'highest-price',
    'lowest-price': 'lowest-price',
}

export function initNearbyProperties() {
    const grid = document.getElementById('nearbyPropertiesGrid')
    const sortSelect = document.getElementById('nearbyPropertiesSort')
    const dots = document.getElementById('nearbyPropertiesDots')
    const mapContainer = document.getElementById('nearbyPropertiesMap')
    if (!grid || !sortSelect) return

    const mobileQuery = window.matchMedia(MOBILE_QUERY)
    const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1024px)')
    const layout = document.querySelector('.nearby-properties-layout')

    // Cache by "sort|limit" so flipping back to an already-fetched
    // combination (e.g. resizing past the breakpoint and back) doesn't
    // re-hit the API.
    const cache = new Map()

    let currentLimit = getLimit()
    let requestId = 0
    let carouselObserver = null
    let latestItems = []
    let mapReady = false

    setupMap()
    setupTabletLayout()
    loadAndRender(sortSelect.value)

    sortSelect.addEventListener('change', () => {
        loadAndRender(sortSelect.value)
    })

    mobileQuery.addEventListener('change', () => {
        const nextLimit = getLimit()
        resizeNearbyMap() // container may have just gone from hidden -> visible
        if (nextLimit === currentLimit) return
        currentLimit = nextLimit
        loadAndRender(sortSelect.value)
    })

    tabletQuery.addEventListener('change', () => {
        applyTabletLayout()
        resizeNearbyMap()
    })

    function setupTabletLayout() {
        applyTabletLayout()
    }

    // Physically reorders the DOM instead of relying solely on CSS
    // `order` — guarantees the map renders above the grid on tablet
    // widths (768–1024px) no matter what else is going on in the
    // cascade, and puts it back below on both mobile and desktop.
    function applyTabletLayout() {
        if (!layout || !mapContainer) return
        if (tabletQuery.matches) {
            layout.prepend(mapContainer)
        } else {
            layout.appendChild(mapContainer)
        }
    }

    grid.addEventListener('click', (event) => {
        const favoriteBtn = event.target.closest('.property-card-favorite')
        if (favoriteBtn) {
            toggleFavorite(favoriteBtn)
        }
    })

    // Card <-> marker sync: hovering OR keyboard-focusing a card
    // highlights its map pin. focusin/focusout (unlike focus/blur) bubble,
    // so this also covers tabbing through the card's links/button.
    grid.addEventListener('mouseover', (event) => handleCardHoverEvent(event, true))
    grid.addEventListener('mouseout', (event) => handleCardHoverEvent(event, false))
    grid.addEventListener('focusin', (event) => handleCardHoverEvent(event, true))
    grid.addEventListener('focusout', (event) => handleCardHoverEvent(event, false))

    function handleCardHoverEvent(event, isActive) {
        const card = event.target.closest('.property-card')
        const id = card?.dataset.propertyId
        if (!id || !mapReady) return
        highlightMarker(id, isActive)
    }

    dots?.addEventListener('click', (event) => {
        const dot = event.target.closest('.nearby-properties-dot')
        if (!dot) return
        const card = grid.children[Number(dot.dataset.index)]
        card?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    })

    async function setupMap() {
        if (!mapContainer) return
        try {
            await loadGoogleMaps()
            initNearbyMap(mapContainer)
            setNearbyMapHandlers({
                onHover: (id) => highlightCard(id, true),
                onLeave: (id) => highlightCard(id, false),
                onClick: (id) => {
                    const card = grid.querySelector(
                        `.property-card[data-property-id="${cssEscape(id)}"]`
                    )
                    highlightCard(id, true)
                    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                },
            })
            mapReady = true
            console.debug(`[nearby-map] map ready, ${latestItems.length} item(s) queued`)
            if (latestItems.length) renderMarkers(latestItems)
        } catch (err) {
            console.error('Failed to load Google Maps:', err.message)
            mapContainer.innerHTML = `
                <span class="nearby-properties-map-note">Map unavailable: ${escapeHtml(err.message)}</span>
            `
        }
    }

    function highlightCard(id, isActive) {
        const card = grid.querySelector(`.property-card[data-property-id="${cssEscape(id)}"]`)
        card?.classList.toggle('property-card--active', isActive)
    }

    function getLimit() {
        return mobileQuery.matches ? LIMITS.mobile : LIMITS.desktop
    }

    async function loadAndRender(sortValue) {
        currentLimit = getLimit()
        const cacheKey = `${sortValue}|${currentLimit}`
        const thisRequest = ++requestId

        renderLoading(currentLimit)

        if (cache.has(cacheKey)) {
            renderCards(cache.get(cacheKey))
            return
        }

        try {
            const items = await fetchProperties(sortValue, currentLimit)
            if (thisRequest !== requestId) return // a newer request superseded this one
            cache.set(cacheKey, items)
            renderCards(items)
        } catch (err) {
            if (thisRequest !== requestId) return
            console.error('Failed to load nearby properties', err)
            renderError()
        }
    }

    async function fetchProperties(sortValue, limit) {
        const base = window.__ENV__?.API_BASE_URL || ''
        const params = new URLSearchParams({
            [SORT_PARAMS[sortValue] || SORT_PARAMS['most-popular']]: 'true',
            limit: String(limit),
        })
        const response = await fetch(`${base}/get-property?${params.toString()}`)
        if (!response.ok) throw new Error(`Request failed with ${response.status}`)
        return response.json()
    }

    function renderLoading(count) {
        grid.innerHTML = Array.from({ length: count }, () => skeletonCardMarkup()).join('')
        renderDots(0) // clear dots while loading — nothing to jump to yet
    }

    function renderError() {
        grid.innerHTML = `
            <p class="nearby-properties-empty">
                We couldn't load nearby properties right now. Please try again shortly.
            </p>
        `
        renderDots(0)
    }

    function renderCards(items) {
        latestItems = items || []

        if (!items || items.length === 0) {
            grid.innerHTML = `<p class="nearby-properties-empty">No nearby properties found.</p>`
            renderDots(0)
            if (mapReady) renderMarkers([])
            return
        }
        const favorites = getFavorites()
        grid.innerHTML = items.map((item) => cardMarkup(item, favorites)).join('')
        renderDots(items.length)
        if (mapReady) renderMarkers(items)
    }

    // ---- mobile carousel dots ----------------------------------------
    // One dot per rendered card (so 4 items on mobile = 4 dots), synced
    // to which card is currently in view via IntersectionObserver.

    function renderDots(count) {
        carouselObserver?.disconnect()
        carouselObserver = null

        if (!dots) return

        if (count < 2) {
            dots.innerHTML = ''
            return
        }

        dots.innerHTML = Array.from(
            { length: count },
            (_, i) =>
                `<button
                    type="button"
                    class="nearby-properties-dot${i === 0 ? ' nearby-properties-dot-active' : ''}"
                    data-index="${i}"
                    aria-label="Go to property ${i + 1}"
                ></button>`
        ).join('')

        const dotEls = Array.from(dots.querySelectorAll('.nearby-properties-dot'))
        const cardEls = Array.from(grid.children)

        carouselObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return
                    const index = cardEls.indexOf(entry.target)
                    if (index === -1) return
                    dotEls.forEach((dot, i) =>
                        dot.classList.toggle('nearby-properties-dot-active', i === index)
                    )
                })
            },
            { root: grid, threshold: 0.6 }
        )

        cardEls.forEach((card) => carouselObserver.observe(card))
    }
}

// ---- favorites (persisted by property ID in localStorage) ------------

function getFavorites() {
    try {
        const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
        return new Set(Array.isArray(raw) ? raw : [])
    } catch {
        return new Set()
    }
}

function saveFavorites(favorites) {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]))
    } catch {
        // localStorage unavailable (private mode, quota, etc.) — favoriting
        // still works for the current page view, it just won't persist.
    }
}

function toggleFavorite(button) {
    const card = button.closest('.property-card')
    const id = card?.dataset.propertyId
    if (!id) return

    const favorites = getFavorites()
    const isActive = favorites.has(id)

    if (isActive) {
        favorites.delete(id)
    } else {
        favorites.add(id)
    }
    saveFavorites(favorites)
    setFavoriteButtonState(button, !isActive)
}

function setFavoriteButtonState(button, isActive) {
    button.setAttribute('aria-pressed', String(isActive))
    const icon = button.querySelector('i')
    if (icon) {
        icon.classList.toggle('fa-solid', isActive)
        icon.classList.toggle('fa-regular', !isActive)
    }
}

function cardMarkup(item, favorites) {
    const property = item.Property || {}
    const geo = item.GeoInfo || {}
    const partnerUrl = item.Partner?.URL || '#'
    const id = String(item.ID || '')
    const isFavorite = favorites?.has(id)

    const name = escapeHtml(property.PropertyName || 'Property')
    const price = formatPrice(property.CachePrice ?? property.Price)
    const score = formatScore(property.ReviewScore)
    const reviewCount = property.Counts?.Reviews ?? 0
    const location = escapeHtml(formatLocation(geo))
    const amenities = escapeHtml(formatAmenities(property.TopAmenities))
    const imageUrl = property.FeatureImage ? `${IMG_BASE_URL}${property.FeatureImage}` : ''

    return `
        <article class="property-card" data-property-id="${escapeHtml(id)}">
            <div class="property-card-media">
                ${
                    imageUrl
                        ? `<img class="property-card-image" src="${imageUrl}" alt="${name}" loading="lazy">`
                        : `<div class="property-card-image property-card-image--placeholder"></div>`
                }
                <button
                    type="button"
                    class="property-card-favorite"
                    aria-label="Save ${name} to favorites"
                    aria-pressed="${isFavorite ? 'true' : 'false'}"
                >
                    <i class="fa-${isFavorite ? 'solid' : 'regular'} fa-heart" aria-hidden="true"></i>
                </button>
            </div>

            <div class="property-card-body">
                <p class="property-card-rating">
                    <span class="property-card-score"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> ${score}</span>
                    <span class="property-card-reviews">${reviewCount} Reviews</span>
                </p>

                <h3 class="property-card-title">${name}</h3>
                <p class="property-card-source">Booking.com</p>
                <p class="property-card-price">From ${price}</p>
                ${amenities ? `<p class="property-card-amenities">${amenities}</p>` : ''}
                <p class="property-card-location">${location}</p>

                <div class="property-card-actions">
                    <a class="btn btn-outline btn-sm" href="${partnerUrl}" target="_blank" rel="noopener">Learn More</a>
                    <a class="btn btn-accent btn-sm" href="${partnerUrl}" target="_blank" rel="noopener">See Dates</a>
                </div>
            </div>
        </article>
    `
}

function skeletonCardMarkup() {
    return `
        <article class="property-card property-card--skeleton" aria-hidden="true">
            <div class="property-card-media property-card-media--skeleton"></div>
            <div class="property-card-body">
                <div class="skeleton-line skeleton-line--sm"></div>
                <div class="skeleton-line skeleton-line--lg"></div>
                <div class="skeleton-line skeleton-line--md"></div>
            </div>
        </article>
    `
}

function formatPrice(amount) {
    if (amount === undefined || amount === null) return 'N/A'
    return `$${Math.round(Number(amount)).toLocaleString('en-US')}`
}

function formatScore(score) {
    const value = Number(score)
    return Number.isFinite(value) ? value.toFixed(1) : 'N/A'
}

function formatLocation(geo) {
    if (geo.Display) return geo.Display
    return [geo.City, geo.Country].filter(Boolean).join(', ')
}

function formatAmenities(topAmenities) {
    if (!Array.isArray(topAmenities) || topAmenities.length === 0) return ''
    return topAmenities
        .slice(0, 3)
        .map((amenity) => amenity.Name)
        .join(' \u00b7 ')
}

function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value)
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
