import { Router } from 'express'

import mostPopular from '../data/most_popular.json' with { type: 'json' }
import highestPrice from '../data/highest_price.json' with { type: 'json' }
import lowestPrice from '../data/lowest_price.json' with { type: 'json' }

const router = Router()

router.get('/get-property', (req, res) => {
    let {
        'most-popular': mostPopularQuery,
        'highest-price': highestPriceQuery,
        'lowest-price': lowestPriceQuery,
        limit,
    } = req.query

    let data = mostPopular

    if (mostPopularQuery === 'true') {
        data = mostPopular
    } else if (highestPriceQuery === 'true') {
        data = highestPrice
    } else if (lowestPriceQuery === 'true') {
        data = lowestPrice
    }

    const items = data.Result.Items

    if (limit !== undefined) {
        const numberLimit = Number(limit)

        if (!Number.isInteger(numberLimit) || numberLimit < 1) {
            return res.status(400).json({ error: 'limit must be a positive number' })
        }

        return res.json(items.slice(0, numberLimit))
    }

    return res.json(items)
})

export default router
