export default function descriptionReadMore() {
    const readMore = document.querySelector('.description-read-more')
    const moreText = document.querySelector('.description-more-text')

    if (!readMore || !moreText) return

    readMore.addEventListener('click', function () {
        const expanded = moreText.style.display === 'inline'

        moreText.style.display = expanded ? 'none' : 'inline'

        readMore.innerHTML = expanded
            ? 'READ MORE <i class="fa-solid fa-chevron-down"></i>'
            : 'READ LESS <i class="fa-solid fa-chevron-up"></i>'
    })
}
