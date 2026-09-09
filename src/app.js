import express from 'express'
import healthRouter from './routes/health.js'
import getPropertyRouter from './routes/get-property.js'

const app = express()
const PORT = process.env.PORT || 3000

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.get('/health', healthRouter)

app.get('/get-property', getPropertyRouter)

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
