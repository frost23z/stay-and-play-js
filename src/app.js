import express from 'express'
import healthRouter from './routes/health.js'
import getPropertyRouter from './routes/get-property.js'
import imagesRouter from './routes/images.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.static('public'))

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.get('/health', healthRouter)

app.get('/get-property', getPropertyRouter)

app.get('/images', imagesRouter)

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
