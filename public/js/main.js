import { initGallery } from './gallery.js'
import descriptionReadMore from './description.js'
import { initBooking } from './booking.js'
import { initNearbyProperties } from './nearby-properties.js'

document.addEventListener('DOMContentLoaded', () => {
    initGallery()
    descriptionReadMore()
    initBooking()
    initNearbyProperties()
})
