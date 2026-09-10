const DOT_WINDOW = 5
const SWIPE_THRESHOLD = 40

function getApiBaseUrl() {
    const configured = window.__ENV__ && window.__ENV__.API_BASE_URL
    return typeof configured === 'string' ? configured.replace(/\/$/, '') : ''
}

function resolveImageUrl(path) {
    if (!path || /^https?:\/\//i.test(path)) return path
    const base = getApiBaseUrl()
    return base ? `${base}${path.startsWith('/') ? '' : '/'}${path}` : path
}

export async function initGallery() {
    const els = getElements()
    if (!els.gallery) return

    let images = []
    let previewIndex = 0
    let modalListRendered = false
    let lastFocused = null

    try {
        images = await fetchImages()
        images = images.map(resolveImageUrl)
    } catch (err) {
        console.error('Could not load gallery images:', err)
        return
    }

    if (!images.length) return

    updateImageCounts(els, images.length)
    setPreviewIndex(0)
    setupPreviewSwipe()
    setupPreviewArrows()
    setupModalControls()

    // ---- preview -------------------------------------------------------
    // On mobile/tablet this preview IS the gallery: swipe or use the dots
    // to move through every photo, with a counter showing where you are.

    function setPreviewIndex(index) {
        previewIndex = wrap(index, images.length)
        const src = images[previewIndex]
        els.photoMain.src = src
        els.photoMain.alt = `Eagle Creek Golf Club photo ${previewIndex + 1} of ${images.length}`

        if (images[1]) {
            els.photoSide.src = images[1]
        }
        if (images[2]) {
            els.photoFrame.src = images[2]
        }

        if (els.previewCounter) {
            els.previewCounter.textContent = `${previewIndex + 1}/${images.length}`
        }

        renderDots(els.previewDots, images.length, previewIndex, setPreviewIndex)
    }

    function setupPreviewSwipe() {
        attachSwipe(els.gallery, {
            onSwipeLeft: () => setPreviewIndex(previewIndex + 1),
            onSwipeRight: () => setPreviewIndex(previewIndex - 1),
        })
    }

    function setupPreviewArrows() {
        els.prevBtn?.addEventListener('click', () => setPreviewIndex(previewIndex - 1))
        els.nextBtn?.addEventListener('click', () => setPreviewIndex(previewIndex + 1))
    }

    // ---- modal (desktop only: full scrollable photo list) ----------------

    function setupModalControls() {
        els.openTriggers.forEach((btn) => {
            btn.addEventListener('click', openModal)
        })

        els.closeTriggers.forEach((btn) => {
            btn.addEventListener('click', closeModal)
        })

        document.addEventListener('keydown', (event) => {
            if (els.modal.hasAttribute('hidden')) return
            if (event.key === 'Escape') closeModal()
        })
    }

    function openModal() {
        if (!modalListRendered) {
            renderModalList()
            modalListRendered = true
        }

        lastFocused = document.activeElement
        els.modal.removeAttribute('hidden')
        document.body.classList.add('gallery-modal-open')
        els.closeTriggers[0]?.focus()
    }

    function closeModal() {
        els.modal.setAttribute('hidden', '')
        document.body.classList.remove('gallery-modal-open')
        if (lastFocused instanceof HTMLElement) lastFocused.focus()
    }

    function renderModalList() {
        els.modalList.innerHTML = ''
        images.forEach((src, i) => {
            const img = document.createElement('img')
            img.src = src
            img.loading = 'lazy'
            img.alt = `Eagle Creek Golf Club photo ${i + 1} of ${images.length}`
            els.modalList.appendChild(img)
        })
    }
}

// ---- helpers -------------------------------------------------------------

function getElements() {
    return {
        gallery: document.getElementById('gallery'),
        photoMain: document.getElementById('galleryPhotoMain'),
        photoSide: document.getElementById('galleryPhotoSide'),
        photoFrame: document.getElementById('galleryPhotoFrame'),
        previewDots: document.getElementById('galleryPreviewDots'),
        previewCounter: document.getElementById('galleryPreviewCounter'),
        prevBtn: document.getElementById('galleryPrevBtn'),
        nextBtn: document.getElementById('galleryNextBtn'),
        openTriggers: Array.from(document.querySelectorAll('[data-gallery-open]')),
        closeTriggers: Array.from(document.querySelectorAll('[data-gallery-close]')),
        modal: document.getElementById('galleryModal'),
        modalList: document.getElementById('galleryModalList'),
        countEls: Array.from(document.querySelectorAll('.js-image-count')),
    }
}

async function fetchImages() {
    const res = await fetch(`${getApiBaseUrl()}/images`)
    if (!res.ok) throw new Error(`Gallery request failed with status ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : []
}

function updateImageCounts(els, count) {
    els.countEls.forEach((el) => {
        el.textContent = count
    })
}

function wrap(index, length) {
    return ((index % length) + length) % length
}

/**
 * Renders up to DOT_WINDOW dot indicators representing `total` slides,
 * sliding the visible window so the active dot is always shown.
 */
function renderDots(container, total, activeIndex, onSelect) {
    if (!container) return

    container.innerHTML = ''

    const windowSize = Math.min(DOT_WINDOW, total)
    let start = 0
    if (total > DOT_WINDOW) {
        start = Math.min(Math.max(activeIndex - Math.floor(DOT_WINDOW / 2), 0), total - DOT_WINDOW)
    }

    for (let i = start; i < start + windowSize; i += 1) {
        const dot = document.createElement('button')
        dot.type = 'button'
        dot.className = 'gallery-dot'
        if (i === activeIndex) dot.classList.add('gallery-dot-active')
        dot.setAttribute('aria-label', `Go to image ${i + 1}`)
        dot.addEventListener('click', () => onSelect(i))
        container.appendChild(dot)
    }
}

/**
 * Attaches touch-swipe navigation to `el`. Ignores swipes that are more
 * vertical than horizontal so page scrolling still works.
 */
function attachSwipe(el, { onSwipeLeft, onSwipeRight }) {
    if (!el) return

    let startX = 0
    let startY = 0
    let tracking = false

    el.addEventListener(
        'touchstart',
        (event) => {
            const touch = event.touches[0]
            startX = touch.clientX
            startY = touch.clientY
            tracking = true
        },
        { passive: true }
    )

    el.addEventListener(
        'touchend',
        (event) => {
            if (!tracking) return
            tracking = false
            const touch = event.changedTouches[0]
            const deltaX = touch.clientX - startX
            const deltaY = touch.clientY - startY

            if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) {
                return
            }

            if (deltaX < 0) onSwipeLeft()
            else onSwipeRight()
        },
        { passive: true }
    )
}
