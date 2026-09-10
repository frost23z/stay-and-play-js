const PRICE_PER_NIGHT = 2026
const DATEPICKER_FORMAT = 'YYYY-MM-DD'
const DATEPICKER_SEPARATOR = ' - '

const GUEST_LIMITS = {
    guests: { min: 1, max: 16 },
    infants: { min: 0, max: 5 },
    pets: { min: 0, max: 5 },
}

export function initBooking() {
    const els = getElements()
    if (!els.checkInField || !els.checkOutField || !els.guestsField) return

    const state = {
        checkIn: new Date(2026, 8, 24),
        checkOut: new Date(2026, 8, 26),
        guests: 3,
        infants: 1,
        pets: 1,
    }

    let lastFocused = null
    let datepicker = null

    updateDateFields()
    updatePrice()
    updateGuestsField()

    setupDateModal()
    setupGuestsModal()

    // ---- price / summary rendering ----------------------------------

    function nightsBetween(start, end) {
        const ms = end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0)
        return Math.max(1, Math.round(ms / 86400000))
    }

    function formatCurrency(amount) {
        return `USD $${Math.round(amount).toLocaleString('en-US')}`
    }

    function formatDateDisplay(date) {
        const day = date.getDate()
        const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
        const year = date.getFullYear()
        return `${day} ${month} ${year}`
    }

    function formatDateForPicker(date) {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    function formatGuestsSummary(guests, infants, pets) {
        const parts = [`${guests} ${guests === 1 ? 'Guest' : 'Guests'}`]
        if (infants > 0) parts.push(`${infants} ${infants === 1 ? 'Infant' : 'Infants'}`)
        if (pets > 0) parts.push(`${pets} ${pets === 1 ? 'Pet' : 'Pets'}`)
        return parts.join(', ')
    }

    function updateDateFields() {
        els.checkInValue.textContent = formatDateDisplay(state.checkIn)
        els.checkOutValue.textContent = formatDateDisplay(state.checkOut)
    }

    function updatePrice() {
        const nights = nightsBetween(new Date(state.checkIn), new Date(state.checkOut))
        const total = nights * PRICE_PER_NIGHT
        els.pricePerNight.textContent = formatCurrency(PRICE_PER_NIGHT)
        els.pricePerNightValue.textContent = formatCurrency(PRICE_PER_NIGHT)
        els.totalPriceValue.textContent = formatCurrency(total)
    }

    function updateGuestsField() {
        els.guestsValue.textContent = formatGuestsSummary(state.guests, state.infants, state.pets)
    }

    // ---- shared modal open/close helpers -----------------------------

    function openModal(modal, focusTarget) {
        lastFocused = document.activeElement
        modal.removeAttribute('hidden')
        document.body.classList.add('booking-modal-open')
        focusTarget?.focus()
    }

    function closeModal(modal) {
        modal.setAttribute('hidden', '')
        document.body.classList.remove('booking-modal-open')
        if (lastFocused instanceof HTMLElement) lastFocused.focus()
    }

    // ---- date picker modal --------------------------------------------

    function setupDateModal() {
        const openDateModal = () => handleOpenDateModal()

        els.checkInField.addEventListener('click', openDateModal)
        els.checkOutField.addEventListener('click', openDateModal)

        els.dateCloseTriggers.forEach((btn) => {
            btn.addEventListener('click', () => closeModal(els.dateModal))
        })

        document.addEventListener('keydown', (event) => {
            if (els.dateModal.hasAttribute('hidden')) return
            if (event.key === 'Escape') closeModal(els.dateModal)
        })

        els.dateContinue.addEventListener('click', () => {
            if (!datepicker || datepicker.getNights() < 1) return
            const value = els.dateInput.value.split(DATEPICKER_SEPARATOR)
            if (value.length < 2) return

            state.checkIn = parseDatepickerDate(value[0])
            state.checkOut = parseDatepickerDate(value[1])
            updateDateFields()
            updatePrice()
            closeModal(els.dateModal)
        })

        els.dateClear.addEventListener('click', () => {
            datepicker?.clear()
            setContinueState(0)
        })
    }

    function handleOpenDateModal() {
        openModal(els.dateModal, els.dateCloseTriggers[0])

        if (!datepicker) {
            datepicker = createDatepicker()
        }

        // Re-sync the calendar to the last committed range every time the
        // modal opens, so an abandoned selection (closed without hitting
        // Continue) never leaks into the next visit.
        datepicker.setRange(formatDateForPicker(state.checkIn), formatDateForPicker(state.checkOut))
        setContinueState(datepicker.getNights())
    }

    function createDatepicker() {
        // HotelDatepicker + its fecha dependency are loaded locally as
        // globals via <script> tags (see index.html) — no CDN needed.
        els.dateInput.value = `${formatDateForPicker(state.checkIn)}${DATEPICKER_SEPARATOR}${formatDateForPicker(state.checkOut)}`

        return new HotelDatepicker(els.dateInput, {
            format: DATEPICKER_FORMAT,
            separator: DATEPICKER_SEPARATOR,
            startDate: new Date(), // past dates are not selectable
            minNights: 1, // a single date cannot be selected
            inline: true,
            container: els.dateCalendar,
            showTopbar: true,
            clearButton: false,
            autoClose: false,
            onSelectRange: () => {
                setContinueState(datepicker.getNights())
            },
        })
    }

    function setContinueState(nights) {
        if (nights > 0) {
            els.dateContinue.disabled = false
            els.dateContinue.textContent = `Continue \u00b7 ${nights} ${nights === 1 ? 'Night' : 'Nights'}`
        } else {
            els.dateContinue.disabled = true
            els.dateContinue.textContent = 'Continue'
        }
    }

    function parseDatepickerDate(value) {
        const [year, month, day] = value.split('-').map(Number)
        return new Date(year, month - 1, day)
    }

    // ---- guests modal ---------------------------------------------------

    function setupGuestsModal() {
        let draft = { guests: state.guests, infants: state.infants, pets: state.pets }

        els.guestsField.addEventListener('click', () => {
            draft = { guests: state.guests, infants: state.infants, pets: state.pets }
            renderGuestCounts(draft)
            openModal(els.guestsModal, els.guestsCloseTriggers[0])
        })

        els.guestsCloseTriggers.forEach((btn) => {
            btn.addEventListener('click', () => closeModal(els.guestsModal))
        })

        document.addEventListener('keydown', (event) => {
            if (els.guestsModal.hasAttribute('hidden')) return
            if (event.key === 'Escape') closeModal(els.guestsModal)
        })

        els.guestSteppers.forEach((btn) => {
            const type = btn.dataset.guestIncrement || btn.dataset.guestDecrement
            const isIncrement = Boolean(btn.dataset.guestIncrement)

            btn.addEventListener('click', () => {
                const { min, max } = GUEST_LIMITS[type]
                const next = draft[type] + (isIncrement ? 1 : -1)
                draft[type] = Math.min(max, Math.max(min, next))
                renderGuestCounts(draft)
            })
        })

        els.guestsReset.addEventListener('click', () => {
            draft = { guests: GUEST_LIMITS.guests.min, infants: 0, pets: 0 }
            renderGuestCounts(draft)
        })

        els.guestsApply.addEventListener('click', () => {
            state.guests = draft.guests
            state.infants = draft.infants
            state.pets = draft.pets
            updateGuestsField()
            closeModal(els.guestsModal)
        })

        function renderGuestCounts(counts) {
            els.guestsCountGuests.textContent = counts.guests
            els.guestsCountInfants.textContent = counts.infants
            els.guestsCountPets.textContent = counts.pets

            setStepperDisabled('guests', counts.guests)
            setStepperDisabled('infants', counts.infants)
            setStepperDisabled('pets', counts.pets)
        }

        function setStepperDisabled(type, value) {
            const { min, max } = GUEST_LIMITS[type]
            const decrementBtn = document.querySelector(`[data-guest-decrement="${type}"]`)
            const incrementBtn = document.querySelector(`[data-guest-increment="${type}"]`)
            if (decrementBtn) decrementBtn.disabled = value <= min
            if (incrementBtn) incrementBtn.disabled = value >= max
        }
    }
}

// ---- helpers ---------------------------------------------------------

function getElements() {
    return {
        checkInField: document.getElementById('checkInField'),
        checkOutField: document.getElementById('checkOutField'),
        checkInValue: document.getElementById('checkInValue'),
        checkOutValue: document.getElementById('checkOutValue'),
        pricePerNight: document.getElementById('bookingPricePerNight'),
        pricePerNightValue: document.getElementById('pricePerNightValue'),
        totalPriceValue: document.getElementById('totalPriceValue'),

        guestsField: document.getElementById('guestsField'),
        guestsValue: document.getElementById('guestsValue'),

        dateModal: document.getElementById('bookingDateModal'),
        dateInput: document.getElementById('bookingDateInput'),
        dateCalendar: document.getElementById('bookingDatepickerCalendar'),
        dateCloseTriggers: Array.from(document.querySelectorAll('[data-booking-date-close]')),
        dateContinue: document.getElementById('bookingDateContinue'),
        dateClear: document.getElementById('bookingDateClear'),

        guestsModal: document.getElementById('guestsModal'),
        guestsCloseTriggers: Array.from(document.querySelectorAll('[data-guests-close]')),
        guestSteppers: Array.from(
            document.querySelectorAll('[data-guest-increment], [data-guest-decrement]')
        ),
        guestsCountGuests: document.getElementById('guestsCountGuests'),
        guestsCountInfants: document.getElementById('guestsCountInfants'),
        guestsCountPets: document.getElementById('guestsCountPets'),
        guestsReset: document.getElementById('guestsReset'),
        guestsApply: document.getElementById('guestsApply'),
    }
}
