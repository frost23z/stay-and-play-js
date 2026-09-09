import { Router } from 'express'
import { readdir } from 'node:fs/promises'
import path from 'node:path'

const router = Router()

router.get('/images', async (_req, res) => {
    try {
        const files = await readdir(path.join(process.cwd(), 'public/assets/images/gallery'))

        res.json(files.sort().map((file) => `/assets/images/gallery/${file}`))
    } catch {
        res.status(500).json({
            error: 'Failed to load gallery',
        })
    }
})

export default router
