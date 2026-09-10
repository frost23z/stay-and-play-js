import 'dotenv/config'
import express from 'express'
import envRouter from './routes/env.js'
import healthRouter from './routes/health.js'
import getPropertyRouter from './routes/get-property.js'
import imagesRouter from './routes/images.js'

const app = express()
const PORT = process.env.PORT || 3000

// Must be registered before express.static — it serves the same path
// (/js/env.js) that used to be a static file, so this needs to win first.
app.get('/js/env.js', envRouter)

app.use(express.static('public'))

app.get('/health', healthRouter)

app.get('/get-property', getPropertyRouter)

app.get('/images', imagesRouter)

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
