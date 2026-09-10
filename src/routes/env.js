// Serves the client-side config as JS, generated per-request instead of
// as a static file — this is what keeps the Google Maps API key out of
// version control. The real value lives only in the untracked .env file
// (see .env.example) and is read here via process.env.
export default function envRouter(req, res) {
    res.type('application/javascript')
    res.send(`window.__ENV__ = {
    // Empty string = same origin the page was loaded from.
    API_BASE_URL: ${JSON.stringify(process.env.API_BASE_URL || '')},
    GOOGLE_MAPS_API_KEY: ${JSON.stringify(process.env.GOOGLE_MAPS_API_KEY || '')},
    // Required by google.maps.marker.AdvancedMarkerElement. Create one in
    // Cloud Console (Map Management) — "DEMO_MAP_ID" only works for local
    // testing and disables cloud-based map styling.
    GOOGLE_MAPS_MAP_ID: ${JSON.stringify(process.env.GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID')},
}
`)
}
